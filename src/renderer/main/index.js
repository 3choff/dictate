document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-btn');
  const settingsIcon = document.querySelector('.settings-icon');
  const helpButton = document.querySelector('.help-icon');
  const sparkleButton = document.querySelector('.sparkle-icon');
  const micButton = document.querySelector('.mic-button');
  let mediaRecorder;
  let audioChunks = [];
  let dgSocket = null;
  let dgActive = false;
  // Cartesia streaming state
  let ctSocket = null;
  let ctActive = false;
  let ctAudioCtx = null;
  let ctSource = null;
  let ctProcessor = null;
  // Groq (Whisper) simple silence-based segmenter state
  let groqActive = false;
  let groqAudioCtx = null;
  let groqSource = null;
  let groqProcessor = null;
  let groqSamples16k = []; // plain Number[] of int16 samples at 16kHz
  let groqLastBoundary = 0; // index in 16k sample domain
  let groqInSilenceMs = 0;
  let groqHadSpeech = false;
  const GROQ_SILENCE_MS = 1000; // silence of 1s
  const GROQ_SILENCE_DB = -30; // classify more as silence
  const GROQ_MAX_SEGMENT_MS = 15000; // safety cut at 15s
  const GROQ_MIN_SEGMENT_MS = 200; // ignore ultra-short noise-only

  function dbfsFromRms(rms) {
    if (rms <= 1e-9) return -120;
    return 20 * Math.log10(rms);
  }

  function mixToMonoFloat32(audioBuffer) {
    const ch = audioBuffer.numberOfChannels;
    if (ch === 1) {
      return audioBuffer.getChannelData(0);
    }
    const len = audioBuffer.length;
    const out = new Float32Array(len);
    for (let c = 0; c < ch; c++) {
      const data = audioBuffer.getChannelData(c);
      for (let i = 0; i < len; i++) out[i] += data[i];
    }
    for (let i = 0; i < len; i++) out[i] /= ch;
    return out;
  }

  // Downsample arbitrary input rate to 16k and quantize to Int16
  function downsampleTo16kInt16(float32Mono, inputSampleRate) {
    const targetRate = 16000;
    const ratio = inputSampleRate / targetRate;
    const newLength = Math.floor(float32Mono.length / ratio);
    const out = new Int16Array(newLength);
    let iOut = 0;
    for (let i = 0; i < newLength; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.floor((i + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let j = start; j < end && j < float32Mono.length; j++) {
        sum += float32Mono[j];
        count++;
      }
      const sample = count ? sum / count : float32Mono[Math.min(start, float32Mono.length - 1)];
      const s = Math.max(-1, Math.min(1, sample));
      out[iOut++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  function encodeWav16kMono(int16Samples) {
    const numSamples = int16Samples.length;
    const headerSize = 44;
    const dataSize = numSamples * 2;
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // channels
    view.setUint32(24, 16000, true); // sample rate
    view.setUint32(28, 16000 * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    // PCM data
    let off = 44;
    for (let i = 0; i < numSamples; i++, off += 2) view.setInt16(off, int16Samples[i], true);
    return new Uint8Array(buffer);
  }

  function normalizeWhisperTranscript(text, preserveFormattingEnabled) {
    if (preserveFormattingEnabled) return text;
    try {
      const lower = text.toLowerCase();
      const cleaned = lower
        .normalize('NFKC')
        .replace(/[.,\/#!$%\^&*;:{}=_'`~()\[\]"<>?@+|\\-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned;
    } catch (_err) {
      return text.toLowerCase();
    }
  }

  function emitGroqSegmentIfReady(boundaryIndex) {
    const samplesSinceBoundary = boundaryIndex - groqLastBoundary;
    const msSinceBoundary = (samplesSinceBoundary / 16000) * 1000;
    if (!groqHadSpeech || msSinceBoundary < GROQ_MIN_SEGMENT_MS) return;
    const seg = groqSamples16k.slice(groqLastBoundary, boundaryIndex);
    const wavBytes = encodeWav16kMono(Int16Array.from(seg));
    console.log('[Segmenter] Emit segment', {
      samples: seg.length,
      ms: Math.round(msSinceBoundary),
      bytes: wavBytes.length,
    });
    window.electronAPI.saveAudioSegment(wavBytes);
    groqLastBoundary = boundaryIndex;
    groqHadSpeech = false;
    groqInSilenceMs = 0;
    // Drop older samples to keep memory bounded
    if (groqLastBoundary > 0) {
      groqSamples16k = groqSamples16k.slice(groqLastBoundary);
      groqLastBoundary = 0;
    }
  }

  let beepSound;
  let clackSound;

  async function loadAudio() {
    try {
      // Try base64 first for packaged reliability
      const beepBase64 = await window.electronAPI.getAssetBase64('assets/audio/beep.mp3');
      if (beepBase64) {
        beepSound = new Audio(`data:audio/mpeg;base64,${beepBase64}`);
      } else {
        const beepUrl = await window.electronAPI.getAssetFileUrl('assets/audio/beep.mp3');
        console.warn('Beep base64 missing, using file URL', beepUrl);
        beepSound = new Audio(beepUrl);
      }

      const clackBase64 = await window.electronAPI.getAssetBase64('assets/audio/clack.mp3');
      if (clackBase64) {
        clackSound = new Audio(`data:audio/mpeg;base64,${clackBase64}`);
      } else {
        const clackUrl = await window.electronAPI.getAssetFileUrl('assets/audio/clack.mp3');
        console.warn('Clack base64 missing, using file URL', clackUrl);
        clackSound = new Audio(clackUrl);
      }

      if (beepSound) {
        beepSound.addEventListener('error', (e) => console.error('beep load/play error', e));
        try {
          beepSound.load();
        } catch (_) {}
      }
      if (clackSound) {
        clackSound.addEventListener('error', (e) => console.error('clack load/play error', e));
        try {
          clackSound.load();
        } catch (_) {}
      }
    } catch (error) {
      console.error('Error loading audio assets:', error);
      // Final fallback to file URLs
      try {
        const beepUrl = await window.electronAPI.getAssetFileUrl('assets/audio/beep.mp3');
        beepSound = new Audio(beepUrl);
        const clackUrl = await window.electronAPI.getAssetFileUrl('assets/audio/clack.mp3');
        clackSound = new Audio(clackUrl);
      } catch (e) {
        console.error('Unable to load audio cues via file URLs', e);
      }
    }
  }

  closeBtn.addEventListener('click', () => {
    window.electronAPI.closeWindow();
  });

  settingsIcon.addEventListener('click', () => {
    window.electronAPI.openSettingsWindow();
  });

  if (helpButton) {
    helpButton.addEventListener('click', () => {
      window.electronAPI.openExternalLink('https://github.com/3choff/dictate');
    });
  }
  if (sparkleButton) {
    sparkleButton.addEventListener('click', () => {
      if (!window.electronAPI) return;
      if (sparkleButton.classList.contains('loading')) {
        // Abort in-flight request and stop pulsing immediately
        if (typeof window.electronAPI.abortSparkle === 'function') {
          window.electronAPI.abortSparkle();
        }
        sparkleButton.classList.remove('loading');
        return;
      }
      // Start new request
      sparkleButton.classList.add('loading');
      if (typeof window.electronAPI.correctSelectionWithGemini === 'function') {
        window.electronAPI.correctSelectionWithGemini();
      }
    });
  }

  if (window.electronAPI && typeof window.electronAPI.onSparkleDone === 'function') {
    window.electronAPI.onSparkleDone(() => {
      if (sparkleButton) sparkleButton.classList.remove('loading');
    });
  }

  // Global shortcut (Ctrl+Shift+G) handler from main process
  if (window.electronAPI && typeof window.electronAPI.onSparkleTrigger === 'function') {
    window.electronAPI.onSparkleTrigger(() => {
      if (sparkleButton) {
        sparkleButton.click();
      }
    });
  }

  window.electronAPI.onToggleMic(() => {
    micButton.click();
  });

  micButton.addEventListener('click', async () => {
    const isRecording = micButton.classList.contains('recording');

    if (isRecording) {
      if (clackSound) clackSound.play().catch((e) => console.error('clack play failed', e));
    } else {
      if (beepSound) beepSound.play().catch((e) => console.error('beep play failed', e));
    }

    micButton.classList.toggle('recording');

    if ((mediaRecorder && mediaRecorder.state === 'recording') || dgActive || ctActive || groqActive) {
      try {
        mediaRecorder.stop();
      } catch (e) {
        /* ignore */
      }
      if (dgActive && dgSocket) {
        try {
          dgSocket.send(JSON.stringify({ type: 'CloseStream' }));
        } catch (_) {}
        try {
          dgSocket.close();
        } catch (_) {}
        dgSocket = null;
        dgActive = false;
      }
      if (ctActive && ctSocket) {
        try {
          ctSocket.send('finalize');
        } catch (_) {}
        try {
          ctSocket.send('done');
        } catch (_) {}
        try {
          ctSocket.close();
        } catch (_) {}
        ctSocket = null;
        ctActive = false;
      }
      try {
        if (ctProcessor) ctProcessor.disconnect();
      } catch (_) {}
      try {
        if (ctSource) ctSource.disconnect();
      } catch (_) {}
      try {
        if (ctAudioCtx) ctAudioCtx.close();
      } catch (_) {}
      ctProcessor = null;
      ctSource = null;
      ctAudioCtx = null;
      if (groqActive) {
        try {
          const currentIndex = groqSamples16k.length;
          const msSinceBoundary = ((currentIndex - groqLastBoundary) / 16000) * 1000;
          if (groqHadSpeech && msSinceBoundary >= GROQ_MIN_SEGMENT_MS) {
            emitGroqSegmentIfReady(currentIndex);
          }
        } catch (_) {}
        try {
          if (groqProcessor) groqProcessor.disconnect();
        } catch (_) {}
        try {
          if (groqSource) groqSource.disconnect();
        } catch (_) {}
        try {
          if (groqAudioCtx) groqAudioCtx.close();
        } catch (_) {}
        groqProcessor = null;
        groqSource = null;
        groqAudioCtx = null;
        groqActive = false;
        groqSamples16k = [];
        groqLastBoundary = 0;
        groqInSilenceMs = 0;
        groqHadSpeech = false;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const settings = await window.electronAPI.getSettings();
        const dgKey = ((settings && (settings.deepgramApiKey || settings.apiKey)) || '').trim();
        const preserveFormatting = settings && settings.preserveFormatting !== false; // default true
        const useDeepgram = settings.apiService === 'deepgram' && dgKey.length > 0;
        const transcriptionLanguage = (settings && settings.transcriptionLanguage) || 'multilingual';
        const deepgramLanguage = window.LanguageMap && window.LanguageMap.getDeepgramLanguage
          ? window.LanguageMap.getDeepgramLanguage(transcriptionLanguage)
          : 'multi';
        const ctKey = ((settings && settings.cartesiaApiKey) || '').trim();
        const useCartesia = settings.apiService === 'cartesia' && ctKey.length > 0;
        const cartesiaLanguage = transcriptionLanguage && transcriptionLanguage !== 'multilingual'
          ? transcriptionLanguage
          : undefined;

        audioChunks = [];

        if (useDeepgram) {
          console.log('[Deepgram] Streaming mode selected');
          dgActive = true;
          const pref = window.Deepgram && Deepgram.pickPreferredMime ? Deepgram.pickPreferredMime() : { mimeType: undefined, encoding: undefined };
          mediaRecorder = new MediaRecorder(stream, pref.mimeType ? { mimeType: pref.mimeType } : undefined);

          const wsUrl = window.Deepgram && Deepgram.buildUrl
            ? Deepgram.buildUrl({ encoding: pref.encoding, smart_format: preserveFormatting, language: deepgramLanguage })
            : 'wss://api.deepgram.com/v1/listen';
          try {
            dgSocket = window.Deepgram && Deepgram.createSocket ? Deepgram.createSocket(dgKey, wsUrl) : new WebSocket(wsUrl, ['token', dgKey]);
          } catch (e) {
            console.error('Deepgram WS open failed', e);
            dgActive = false;
          }

          if (dgSocket) {
            dgSocket.onopen = () => {
              mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0 && dgSocket && dgSocket.readyState === WebSocket.OPEN) {
                  dgSocket.send(event.data);
                }
              };
              try {
                mediaRecorder.start(250);
              } catch (e) {
                mediaRecorder.start();
              }
            };
            dgSocket.onmessage = (event) => {
              try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'Results' && msg.channel && msg.channel.alternatives && msg.channel.alternatives[0]) {
                  const alt = msg.channel.alternatives[0];
                  if (alt.transcript && (msg.is_final || msg.speech_final)) {
                    const transcript = alt.transcript.trim();
                    if (transcript && window.electronAPI && typeof window.electronAPI.processTranscript === 'function') {
                      window.electronAPI.processTranscript(transcript).catch((err) => console.error('processTranscript error (Deepgram)', err));
                    }
                  }
                }
              } catch (e) {
                /* ignore */
              }
            };
            dgSocket.onerror = (e) => console.error('Deepgram WS error', e);
            dgSocket.onclose = () => {
              if (mediaRecorder && mediaRecorder.state === 'recording') {
                try {
                  mediaRecorder.stop();
                } catch (_) {}
              }
              dgActive = false;
              dgSocket = null;
            };
          } else {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (event) => {
              audioChunks.push(event.data);
            };
            mediaRecorder.onstop = async () => {
              const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
              const audioBuffer = await audioBlob.arrayBuffer();
              const audioData = new Uint8Array(audioBuffer);
              window.electronAPI.saveAudio(audioData);
            };
            mediaRecorder.start();
          }
        } else if (useCartesia) {
          console.log('[Cartesia] Streaming mode selected');
          ctActive = true;
          const wsUrl = window.Cartesia && Cartesia.buildUrl
            ? Cartesia.buildUrl({ apiKey: ctKey, encoding: 'pcm_s16le', sample_rate: 16000, language: cartesiaLanguage })
            : 'wss://api.cartesia.ai/stt/websocket';
          try {
            ctSocket = window.Cartesia && Cartesia.createSocket ? Cartesia.createSocket(wsUrl) : new WebSocket(wsUrl);
          } catch (e) {
            console.error('Cartesia WS open failed', e);
            ctActive = false;
          }
          // Build audio pipeline for PCM 16k mono
          ctAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
          try {
            await ctAudioCtx.resume();
          } catch (_) {}
          ctSource = ctAudioCtx.createMediaStreamSource(stream);
          const bufferSize = 4096;
          ctProcessor = ctAudioCtx.createScriptProcessor(bufferSize, 1, 1);
          ctProcessor.onaudioprocess = (ev) => {
            const inBuf = ev.inputBuffer;
            const mono = mixToMonoFloat32(inBuf);
            const int16 = downsampleTo16kInt16(mono, inBuf.sampleRate);
            if (ctSocket && ctSocket.readyState === WebSocket.OPEN) {
              // Send raw little-endian PCM16
              ctSocket.send(int16.buffer);
            }
          };
          if (ctSocket) {
            ctSocket.onopen = () => {
              try {
                ctSource.connect(ctProcessor);
              } catch (_) {}
              try {
                ctProcessor.connect(ctAudioCtx.destination);
              } catch (_) {}
            };
            ctSocket.onmessage = (event) => {
              try {
                const msg = JSON.parse(event.data);
                if (msg && msg.type === 'transcript') {
                  const text = (msg.text || '').trim();
                  if (text && msg.is_final) {
                    const normalized = normalizeWhisperTranscript(text, preserveFormatting);
                    if (normalized && window.electronAPI && typeof window.electronAPI.processTranscript === 'function') {
                      window.electronAPI.processTranscript(normalized).catch((err) => console.error('processTranscript error (Cartesia)', err));
                    }
                  }
                }
              } catch (e) {
                /* ignore non-JSON */
              }
            };
            ctSocket.onerror = (e) => console.error('Cartesia WS error', e);
            ctSocket.onclose = () => {
              try {
                if (ctProcessor) ctProcessor.disconnect();
              } catch (_) {}
              try {
                if (ctSource) ctSource.disconnect();
              } catch (_) {}
              try {
                if (ctAudioCtx) ctAudioCtx.close();
              } catch (_) {}
              ctProcessor = null;
              ctSource = null;
              ctAudioCtx = null;
              ctActive = false;
              ctSocket = null;
            };
          }
        } else {
          console.log('[Segmenter] Silence chunker mode selected');
          groqActive = true;
          groqAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
          try {
            await groqAudioCtx.resume();
          } catch (_) {}
          groqSource = groqAudioCtx.createMediaStreamSource(stream);
          const bufferSize = 4096; // ~85ms at 48k
          groqProcessor = groqAudioCtx.createScriptProcessor(bufferSize, 1, 1);
          let lastDebugLogTs = 0;
          groqProcessor.onaudioprocess = (ev) => {
            const inBuf = ev.inputBuffer;
            const mono = mixToMonoFloat32(inBuf);
            let sumSq = 0;
            for (let i = 0; i < mono.length; i++) {
              const s = mono[i];
              sumSq += s * s;
            }
            const rms = Math.sqrt(sumSq / Math.max(1, mono.length));
            const db = dbfsFromRms(rms);
            const frameMs = (mono.length / inBuf.sampleRate) * 1000;
            if (db < GROQ_SILENCE_DB) {
              groqInSilenceMs += frameMs;
            } else {
              groqInSilenceMs = 0;
              groqHadSpeech = true;
            }
            const now = performance.now();
            if (now - lastDebugLogTs > 1000) {
              console.debug('[Segmenter] dB:', Math.round(db), 'silenceMs:', Math.round(groqInSilenceMs), 'hadSpeech:', groqHadSpeech);
              lastDebugLogTs = now;
            }
            const int16 = downsampleTo16kInt16(mono, inBuf.sampleRate);
            for (let i = 0; i < int16.length; i++) groqSamples16k.push(int16[i]);
            const currentIndex = groqSamples16k.length;
            const currentMsSinceBoundary = ((currentIndex - groqLastBoundary) / 16000) * 1000;
            if (groqInSilenceMs >= GROQ_SILENCE_MS && groqHadSpeech) {
              emitGroqSegmentIfReady(currentIndex);
            } else if (groqHadSpeech && currentMsSinceBoundary >= GROQ_MAX_SEGMENT_MS) {
              emitGroqSegmentIfReady(currentIndex);
            }
          };
          // Important: connect nodes so onaudioprocess fires
          try {
            groqSource.connect(groqProcessor);
          } catch (_) {}
          try {
            groqProcessor.connect(groqAudioCtx.destination);
          } catch (_) {}
        }
      } catch (err) {
        console.error('Error accessing microphone:', err);
        micButton.classList.remove('recording');
      }
    }
  });

  const COMPACT_CLASS = 'compact-mode';
  const TRANSITIONING_CLASS = 'transitioning';
  const ENTER_CLASS = 'compact-enter';
  const EXIT_CLASS = 'compact-exit';

  function toggleCompactMode(targetState) {
    const isCompact = document.body.classList.contains(COMPACT_CLASS);
    const shouldCompact = typeof targetState === 'boolean' ? targetState : !isCompact;

    if (shouldCompact === isCompact) {
      return;
    }

    const enteringCompact = shouldCompact;

    document.body.classList.add(TRANSITIONING_CLASS);
    document.body.classList.remove(ENTER_CLASS, EXIT_CLASS);
    document.body.classList.add(enteringCompact ? ENTER_CLASS : EXIT_CLASS);

    requestAnimationFrame(() => {
      if (enteringCompact) {
        document.body.classList.add(COMPACT_CLASS);
      } else {
        document.body.classList.remove(COMPACT_CLASS);
      }

      setTimeout(() => {
        document.body.classList.remove(TRANSITIONING_CLASS, ENTER_CLASS, EXIT_CLASS);
      }, 200);
    });

    if (window.electronAPI && typeof window.electronAPI.toggleCompactMode === 'function') {
      window.electronAPI.toggleCompactMode(shouldCompact);
    }
  }

  document.body.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    toggleCompactMode();
  });

  loadAudio();
});
