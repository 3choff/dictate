// Check if Tauri APIs are available
if (!window.__TAURI__) {
    console.error('Tauri APIs not found!');
    document.getElementById('status').textContent = 'Tauri APIs not loaded';
}

const { invoke } = window.__TAURI__?.core || {};
const { listen } = window.__TAURI__?.event || {};

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Keep a warm microphone stream for faster start/stop
let micStream = null;
let micReleaseTimer = null;
const MIC_RELEASE_DELAY_MS = 8000; // release mic a bit after stopping to speed up re-starts
let ignoreNextMicClick = false; // suppress click after pointerdown-start
let ignoreNextSettingsClick = false;
let ignoreNextGrammarClick = false;

// Segmentation state (for non-streaming providers)
let segmentationActive = false;
let segmentAudioCtx = null;
let segmentSource = null;
let segmentProcessor = null;
let segmentSamples16k = [];
let segmentLastBoundary = 0;
let segmentInSilenceMs = 0;
let segmentHadSpeech = false;
let segmentIsProcessing = false; // Prevent duplicate requests

// Segmentation constants
const SEGMENT_SILENCE_MS = 700;      // 700ms of silence triggers segment
const SEGMENT_SILENCE_DB = -30;       // dB threshold for silence detection
const SEGMENT_MAX_DURATION_MS = 15000; // Max 15s per segment (safety)
const SEGMENT_MIN_DURATION_MS = 200;   // Min 200ms (ignore noise)

const micButton = document.getElementById('micButton');
const settingsBtn = document.getElementById('settingsBtn');
const grammarBtn = document.getElementById('grammarBtn');
const closeBtnTop = document.getElementById('close-btn-top');
const closeBtnCompact = document.getElementById('close-btn-compact');
const audioVisualizer = document.getElementById('audioVisualizer');
const status = { textContent: '' }; // Dummy status object since we don't have a status element

// API key and insertion mode will be loaded from settings
let GROQ_API_KEY = '';
let SAMBANOVA_API_KEY = '';
let FIREWORKS_API_KEY = '';
let GEMINI_API_KEY = '';
let MISTRAL_API_KEY = '';
let DEEPGRAM_API_KEY = '';
let CARTESIA_API_KEY = '';
let API_SERVICE = 'groq';

// Streaming provider detection
const STREAMING_PROVIDERS = ['deepgram', 'cartesia'];
let streamingSessionId = null;

// ===== UNIFIED AUDIO CAPTURE ARCHITECTURE =====
// Single AudioContext that serves all providers
let unifiedAudioCtx = null;
let unifiedSource = null;
let unifiedProcessor = null;
let unifiedClonedStream = null; // Store cloned stream for Deepgram cleanup

// Provider-specific handlers (MediaRecorder for Deepgram)
let deepgramMediaRecorder = null;

let INSERTION_MODE = 'typing';
let LANGUAGE = 'multilingual';
let TEXT_FORMATTED = true;
let VOICE_COMMANDS_ENABLED = true;

// Audio cues (loaded at startup)
let beepSound = null;
let clackSound = null;

function loadAudioCues() {
    try {
        // main/index.html -> assets are at ../assets/
        beepSound = new Audio('../assets/audio/beep.mp3');
        clackSound = new Audio('../assets/audio/clack.mp3');

        // Preload and basic error logging
        if (beepSound) {
            beepSound.addEventListener('error', (e) => console.error('[AUDIO] beep load/play error', e));
            try { beepSound.load(); } catch (_) {}
        }
        if (clackSound) {
            clackSound.addEventListener('error', (e) => console.error('[AUDIO] clack load/play error', e));
            try { clackSound.load(); } catch (_) {}
        }
    } catch (e) {
        console.error('[AUDIO] Failed to initialize audio cues:', e);
    }
}

function playBeep() {
    try {
        if (beepSound) {
            // reset to start for rapid replays
            try { beepSound.currentTime = 0; } catch (_) {}
            beepSound.play().catch(() => {});
        }
    } catch (_) {}
}

function playClack() {
    try {
        if (clackSound) {
            try { clackSound.currentTime = 0; } catch (_) {}
            clackSound.play().catch(() => {});
        }
    } catch (_) {}
}

// Audio processing helper functions
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
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint32(28, 16000 * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    let off = 44;
    for (let i = 0; i < numSamples; i++, off += 2) view.setInt16(off, int16Samples[i], true);
    return new Uint8Array(buffer);
}

async function emitSegmentIfReady(boundaryIndex) {
    // Prevent duplicate processing
    if (segmentIsProcessing) return;
    
    const samplesSinceBoundary = boundaryIndex - segmentLastBoundary;
    const msSinceBoundary = (samplesSinceBoundary / 16000) * 1000;
    if (!segmentHadSpeech || msSinceBoundary < SEGMENT_MIN_DURATION_MS) return;
    
    const seg = segmentSamples16k.slice(segmentLastBoundary, boundaryIndex);
    const wavBytes = encodeWav16kMono(Int16Array.from(seg));
    
    
    // Mark as processing to prevent duplicates
    segmentIsProcessing = true;
    
    // Update boundary and reset state BEFORE sending to prevent re-processing
    segmentLastBoundary = boundaryIndex;
    segmentHadSpeech = false;
    segmentInSilenceMs = 0;
    
    // Drop older samples to keep memory bounded
    if (segmentLastBoundary > 0) {
        segmentSamples16k = segmentSamples16k.slice(segmentLastBoundary);
        segmentLastBoundary = 0;
    }
    
    // Send to backend for transcription
    try {
        let apiKeyToUse = GROQ_API_KEY;
        if (API_SERVICE === 'sambanova') {
            apiKeyToUse = SAMBANOVA_API_KEY;
        } else if (API_SERVICE === 'fireworks') {
            apiKeyToUse = FIREWORKS_API_KEY;
        } else if (API_SERVICE === 'gemini') {
            apiKeyToUse = GEMINI_API_KEY;
        } else if (API_SERVICE === 'mistral') {
            apiKeyToUse = MISTRAL_API_KEY;
        }
        console.log(`[Transcribe] provider=${API_SERVICE} lang=${LANGUAGE} formatted=${TEXT_FORMATTED} voiceCmds=${VOICE_COMMANDS_ENABLED} bytes=${wavBytes.length} keySet=${Boolean(apiKeyToUse)}`);
        const returned = await invoke('transcribe_audio_segment', {
            audioData: Array.from(wavBytes),
            apiKey: apiKeyToUse,
            insertionMode: INSERTION_MODE,
            language: LANGUAGE,
            textFormatted: TEXT_FORMATTED,
            apiService: API_SERVICE,
            voiceCommandsEnabled: VOICE_COMMANDS_ENABLED
        });
        if (typeof returned === 'string') {
            console.log(`[Transcribe] backend returned length=${returned.length}`);
        } else {
            console.log('[Transcribe] backend returned non-string payload');
        }
    } catch (error) {
        console.error('[Transcribe] error invoking transcribe_audio_segment', error);
        const errorMsg = error.toString();
        
        // Show user-friendly error in status (briefly)
        if (errorMsg.includes('Rate limit')) {
            status.textContent = '⚠️ Rate limit';
            setTimeout(() => {
                if (isRecording) status.textContent = 'Recording...';
            }, 2000);
        } else if (errorMsg.includes('Network')) {
            status.textContent = '⚠️ Network error';
            setTimeout(() => {
                if (isRecording) status.textContent = 'Recording...';
            }, 2000);
        }
    } finally {
        segmentIsProcessing = false;
    }
}

// Load API key from settings and restore compact mode
async function loadSettings() {
    try {
        const settings = await invoke('get_settings');
        GROQ_API_KEY = settings.groq_api_key || '';
        SAMBANOVA_API_KEY = settings.sambanova_api_key || '';
        FIREWORKS_API_KEY = settings.fireworks_api_key || '';
        GEMINI_API_KEY = settings.gemini_api_key || '';
        MISTRAL_API_KEY = settings.mistral_api_key || '';
        DEEPGRAM_API_KEY = settings.deepgram_api_key || '';
        CARTESIA_API_KEY = settings.cartesia_api_key || '';
        API_SERVICE = settings.api_service || 'groq';
        INSERTION_MODE = settings.insertion_mode || 'typing';
        LANGUAGE = (settings.language || 'multilingual');
        TEXT_FORMATTED = (settings.text_formatted !== false);  // Default true
        VOICE_COMMANDS_ENABLED = (settings.voice_commands_enabled !== false);  // Default true
        console.log(`[Settings] Loaded: provider=${API_SERVICE} lang=${LANGUAGE} formatted=${TEXT_FORMATTED} voiceCmds=${VOICE_COMMANDS_ENABLED} groqKeySet=${Boolean(GROQ_API_KEY)} sambaKeySet=${Boolean(SAMBANOVA_API_KEY)} fireworksKeySet=${Boolean(FIREWORKS_API_KEY)} geminiKeySet=${Boolean(GEMINI_API_KEY)} mistralKeySet=${Boolean(MISTRAL_API_KEY)} deepgramKeySet=${Boolean(DEEPGRAM_API_KEY)} cartesiaKeySet=${Boolean(CARTESIA_API_KEY)}`);
        
        // Restore compact mode state
        if (settings.compact_mode) {
            document.body.classList.add('compact-mode');
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Toggle settings window on pointerdown for faster response
settingsBtn.addEventListener('pointerdown', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    ignoreNextSettingsClick = true;
    try {
        await invoke('open_settings_window');
    } catch (error) {
        console.error('Failed to open settings:', error);
    }
});
settingsBtn.addEventListener('pointercancel', () => { ignoreNextSettingsClick = false; });
settingsBtn.addEventListener('click', async (e) => {
    if (ignoreNextSettingsClick) {
        e.preventDefault();
        e.stopPropagation();
        ignoreNextSettingsClick = false;
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    try {
        await invoke('open_settings_window');
    } catch (error) {
        console.error('Failed to open settings:', error);
    }
});

// Close button handlers - exit on click (not pointerdown)
const handleCloseClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
        await invoke('exit_app');
    } catch (error) {
        console.error('Failed to exit app:', error);
    }
};

// Attach to both close buttons
if (closeBtnTop) {
    closeBtnTop.addEventListener('click', handleCloseClick);
}
if (closeBtnCompact) {
    closeBtnCompact.addEventListener('click', handleCloseClick);
}

// Instant pressed-state feedback for all buttons
for (const el of [micButton, settingsBtn, grammarBtn]) {
    if (!el) continue;
    el.addEventListener('pointerdown', () => el.classList.add('pressed'));
    el.addEventListener('pointerup', () => el.classList.remove('pressed'));
    el.addEventListener('pointercancel', () => el.classList.remove('pressed'));
    el.addEventListener('mouseleave', () => el.classList.remove('pressed'));
}

// Start/stop on pointerdown for faster response
micButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    ignoreNextMicClick = true; // prevent the synthesized click from toggling again
    if (!isRecording) {
        // Play start cue
        playBeep();
        // Immediate visual response
        isRecording = true;
        micButton.classList.add('recording');
        audioVisualizer?.classList.add('active');
        status.textContent = 'Starting...';
        // Start asynchronously and revert if it fails
        startRecording().catch((err) => {
            console.error('Error starting recording:', err);
            isRecording = false;
            micButton.classList.remove('recording');
            audioVisualizer?.classList.remove('active');
            status.textContent = 'Microphone access denied';
        });
    } else {
        // Play stop cue
        playClack();
        // Immediate visual response for stopping
        stopRecording();
    }
});

// In case of pointer cancellation, allow next click
micButton.addEventListener('pointercancel', () => { ignoreNextMicClick = false; });

// Fallback click handler (suppressed after pointerdown)
micButton.addEventListener('click', (e) => {
    if (ignoreNextMicClick) {
        e.preventDefault();
        e.stopPropagation();
        ignoreNextMicClick = false;
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (!isRecording) {
        // Play start cue
        playBeep();
        // Immediate visual response
        isRecording = true;
        micButton.classList.add('recording');
        audioVisualizer?.classList.add('active');
        status.textContent = 'Starting...';
        // Start asynchronously and revert if it fails
        startRecording().catch((err) => {
            console.error('Error starting recording:', err);
            isRecording = false;
            micButton.classList.remove('recording');
            audioVisualizer?.classList.remove('active');
            status.textContent = 'Microphone access denied';
        });
    } else {
        // Play stop cue
        playClack();
        // Immediate visual response for stopping
        stopRecording();
    }
});

// Listen for global shortcuts with debounce to prevent double-firing
let lastShortcutTime = 0;
listen('toggle-recording', () => {
    const now = Date.now();
    if (now - lastShortcutTime < 500) return;
    lastShortcutTime = now;
    toggleRecording();
});

listen('toggle-settings', async () => {
    const now = Date.now();
    if (now - lastShortcutTime < 500) return;
    lastShortcutTime = now;
    try {
        await invoke('open_settings_window');
    } catch (error) {
        console.error('Failed to open settings:', error);
    }
});

async function performGrammarCorrection() {
    try {
        // Backend will use the selected grammar provider from settings
        // Pass Groq key for backward compatibility (backend reads provider's key from settings)
        if (!GROQ_API_KEY) {
            console.error('API key not set');
            return;
        }
        // Show loading state
        grammarBtn.classList.add('loading');
        // Copy selected text using backend (simulates Ctrl+C)
        const selectedText = await invoke('copy_selected_text');
        if (!selectedText || !selectedText.trim()) {
            console.warn('No text selected');
            grammarBtn.classList.remove('loading');
            return;
        }
        // Call backend to correct grammar
        const correctedText = await invoke('correct_grammar', {
            text: selectedText,
            apiKey: GROQ_API_KEY
        });
        // Insert corrected text via clipboard regardless of settings
        await invoke('insert_text', { 
            text: correctedText,
            insertionMode: 'clipboard'
        });
    } catch (error) {
        console.error('Grammar correction error:', error);
    } finally {
        grammarBtn.classList.remove('loading');
    }
}

// Grammar correction on pointerdown for faster response
grammarBtn.addEventListener('pointerdown', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    ignoreNextGrammarClick = true;
    await performGrammarCorrection();
});
grammarBtn.addEventListener('pointercancel', () => { ignoreNextGrammarClick = false; });
grammarBtn.addEventListener('click', async (e) => {
    if (ignoreNextGrammarClick) {
        e.preventDefault();
        e.stopPropagation();
        ignoreNextGrammarClick = false;
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    await performGrammarCorrection();
});

async function toggleRecording() {
    // Kept for shortcut handlers; click path handles immediate UI
    if (!isRecording) {
        // Play start cue (may be blocked if not a user gesture)
        playBeep();
        // Mirror click behavior
        isRecording = true;
        micButton.classList.add('recording');
        audioVisualizer?.classList.add('active');
        status.textContent = 'Starting...';
        try {
            await startRecording();
        } catch (err) {
            console.error('Error starting recording:', err);
            isRecording = false;
            micButton.classList.remove('recording');
            audioVisualizer?.classList.remove('active');
            status.textContent = 'Microphone access denied';
        }
    } else {
        // Play stop cue (may be blocked if not a user gesture)
        playClack();
        await stopRecording();
    }
}

async function startRecording() {
    try {
        // Reuse warm stream if available, otherwise request
        if (!micStream) {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        // Cancel any scheduled release
        if (micReleaseTimer) {
            clearTimeout(micReleaseTimer);
            micReleaseTimer = null;
        }
        
        // Check if using streaming provider
        const isStreaming = STREAMING_PROVIDERS.includes(API_SERVICE);
        
        if (isStreaming) {
            // STREAMING MODE: Use MediaRecorder and WebSocket
            await startStreamingRecording();
        } else {
            // BATCH MODE: Use segmentation (existing logic)
            await startBatchRecording();
        }
        
        // UI was already set by the caller for immediate feedback
        status.textContent = 'Recording...';
    } catch (error) {
        console.error('Error starting recording:', error);
        throw error;
    }
}

async function startBatchRecording() {
    // Use segmentation mode for batch providers
    segmentationActive = true;
    if (!segmentAudioCtx) {
        segmentAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    try {
        await segmentAudioCtx.resume();
    } catch (_) {}
    
    // Start visualizer for batch providers
    try {
        await invoke('start_visualizer', { sessionId: 'batch_' + Date.now() });
    } catch (error) {
        console.error('[Batch] Failed to start visualizer:', error);
    }
    
    segmentSource = segmentAudioCtx.createMediaStreamSource(micStream);
    const bufferSize = 4096; // ~85ms at 48kHz
    segmentProcessor = segmentAudioCtx.createScriptProcessor(bufferSize, 1, 1);
    
    segmentProcessor.onaudioprocess = (ev) => {
        const inBuf = ev.inputBuffer;
        const mono = mixToMonoFloat32(inBuf);
        
        // Calculate RMS and dB
        let sumSq = 0;
        for (let i = 0; i < mono.length; i++) {
            const s = mono[i];
            sumSq += s * s;
        }
        const rms = Math.sqrt(sumSq / Math.max(1, mono.length));
        const db = dbfsFromRms(rms);
        const frameMs = (mono.length / inBuf.sampleRate) * 1000;
        
        // Silence detection
        if (db < SEGMENT_SILENCE_DB) {
            segmentInSilenceMs += frameMs;
        } else {
            segmentInSilenceMs = 0;
            segmentHadSpeech = true;
        }
        
        // Downsample and accumulate
        const int16 = downsampleTo16kInt16(mono, inBuf.sampleRate);
        for (let i = 0; i < int16.length; i++) segmentSamples16k.push(int16[i]);
        
        // Send to visualizer (non-blocking)
        try {
            const audioData = Array.from(new Uint8Array(int16.buffer));
            invoke('send_visualization_audio', { audioData: audioData }).catch(() => {});
        } catch (_) {}
        
        const currentIndex = segmentSamples16k.length;
        const currentMsSinceBoundary = ((currentIndex - segmentLastBoundary) / 16000) * 1000;
        
        // Emit segment on silence or max duration (don't await to prevent blocking)
        if (segmentInSilenceMs >= SEGMENT_SILENCE_MS && segmentHadSpeech && !segmentIsProcessing) {
            emitSegmentIfReady(currentIndex);
        } else if (segmentHadSpeech && currentMsSinceBoundary >= SEGMENT_MAX_DURATION_MS && !segmentIsProcessing) {
            emitSegmentIfReady(currentIndex);
        }
    };
    
    // Connect audio nodes
    try {
        segmentSource.connect(segmentProcessor);
    } catch (_) {}
    try {
        segmentProcessor.connect(segmentAudioCtx.destination);
    } catch (_) {}
}

async function startStreamingRecording() {
    try {
        // Get API key for streaming provider
        let apiKey = '';
        if (API_SERVICE === 'deepgram') {
            apiKey = DEEPGRAM_API_KEY;
        } else if (API_SERVICE === 'cartesia') {
            apiKey = CARTESIA_API_KEY;
        }
        
        if (!apiKey) {
            throw new Error('API key not configured for ' + API_SERVICE);
        }
        
        // Route to appropriate streaming implementation
        if (API_SERVICE === 'deepgram') {
            await startDeepgramStreaming(apiKey);
        } else if (API_SERVICE === 'cartesia') {
            await startCartesiaStreaming(apiKey);
        }
        
    } catch (error) {
        console.error('[Streaming] Failed to start:', error);
        status.textContent = `Error: ${error.message}`;
        throw error;
    }
}

// ===== UNIFIED AUDIO CAPTURE =====
// Single AudioContext that serves both visualization and transcription
async function startUnifiedAudioCapture(provider, sessionId) {
    try {
        // Create single AudioContext for all audio processing
        unifiedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        await unifiedAudioCtx.resume();
        
        // For Deepgram: clone stream to avoid contention with MediaRecorder
        // For other providers: use original stream directly
        if (provider === 'deepgram') {
            unifiedClonedStream = micStream.clone();
            unifiedSource = unifiedAudioCtx.createMediaStreamSource(unifiedClonedStream);
        } else {
            unifiedSource = unifiedAudioCtx.createMediaStreamSource(micStream);
        }
        const bufferSize = 4096;
        unifiedProcessor = unifiedAudioCtx.createScriptProcessor(bufferSize, 1, 1);
        
        unifiedProcessor.onaudioprocess = async (ev) => {
            if (!streamingSessionId) return;
            
            const inBuf = ev.inputBuffer;
            const mono = mixToMonoFloat32(inBuf);
            
            // Check for abnormal spikes (AGC artifacts)
            let maxSample = 0;
            for (let i = 0; i < mono.length; i++) {
                const abs = Math.abs(mono[i]);
                if (abs > maxSample) maxSample = abs;
            }
            
            // Apply soft clipping to reduce AGC spike impact
            if (maxSample > 0.9) {
                for (let i = 0; i < mono.length; i++) {
                    if (Math.abs(mono[i]) > 0.5) {
                        mono[i] *= 0.3;
                    }
                }
            }
            
            // Downsample to 16kHz
            const int16 = downsampleTo16kInt16(mono, inBuf.sampleRate);
            
            // BRANCH 1: Visualization (works for ALL providers)
            try {
                const audioData = Array.from(new Uint8Array(int16.buffer));
                await invoke('send_visualization_audio', {
                    audioData: audioData
                });
            } catch (error) {
                // Silently ignore - visualization is optional
            }
            
            // BRANCH 2: Transcription (provider-specific)
            if (provider === 'cartesia') {
                // Cartesia uses the same PCM16 data
                try {
                    const audioData = Array.from(new Uint8Array(int16.buffer));
                    await invoke('send_streaming_audio', {
                        sessionId: sessionId,
                        audioData: audioData
                    });
                } catch (error) {
                    console.error('[Cartesia] Failed to send audio:', error);
                }
            }
            // Deepgram handled separately via MediaRecorder
        };
        
        // Connect audio nodes
        unifiedSource.connect(unifiedProcessor);
        unifiedProcessor.connect(unifiedAudioCtx.destination);
        
    } catch (error) {
        console.error('[UnifiedAudio] Failed to start:', error);
        throw error;
    }
}

async function startDeepgramStreaming(apiKey) {
    try {
        // Detect preferred audio format (opus is best for Deepgram)
        let mimeType = 'audio/webm;codecs=opus';
        let encoding = 'opus';
        
        if (typeof MediaRecorder.isTypeSupported === 'function') {
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
                encoding = 'opus';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                mimeType = 'audio/webm';
                encoding = 'webm';
            }
        }
        
        // Determine language for Deepgram (use 'multi' for multilingual)
        let streamLanguage = (LANGUAGE === 'multilingual' || !LANGUAGE) ? 'multi' : LANGUAGE;
        
        // Start backend streaming session with encoding info
        streamingSessionId = await invoke('start_streaming_transcription', {
            provider: 'deepgram',
            apiKey: apiKey,
            language: streamLanguage,
            smartFormat: TEXT_FORMATTED,
            insertionMode: INSERTION_MODE,
            encoding: encoding,
            voiceCommandsEnabled: VOICE_COMMANDS_ENABLED
        });
        
        // Start unified audio capture (handles visualization automatically)
        await startUnifiedAudioCapture('deepgram', streamingSessionId);
        
        // Create MediaRecorder for Deepgram's encoded audio (transcription only)
        deepgramMediaRecorder = new MediaRecorder(micStream, { mimeType: mimeType });
        
        deepgramMediaRecorder.ondataavailable = async (event) => {
            if (event.data && event.data.size > 0 && streamingSessionId) {
                try {
                    // Convert Blob to ArrayBuffer to Uint8Array
                    const arrayBuffer = await event.data.arrayBuffer();
                    const audioData = Array.from(new Uint8Array(arrayBuffer));
                    
                    // Send encoded audio to Deepgram for transcription
                    await invoke('send_streaming_audio', {
                        sessionId: streamingSessionId,
                        audioData: audioData
                    });
                } catch (error) {
                    console.error('[Deepgram] Failed to send audio:', error);
                }
            }
        };
        
        deepgramMediaRecorder.onerror = (error) => {
            console.error('[Deepgram] MediaRecorder error:', error);
        };
        
        // Start recording with chunks every 250ms
        try {
            deepgramMediaRecorder.start(250);
        } catch (e) {
            deepgramMediaRecorder.start();
        }
        
    } catch (error) {
        console.error('[Deepgram] Failed to start:', error);
        status.textContent = `Error: ${error.message}`;
        throw error;
    }
}

async function startCartesiaStreaming(apiKey) {
    try {
        // Cartesia uses raw language code (omit for multilingual)
        let streamLanguage = (LANGUAGE === 'multilingual' || !LANGUAGE) ? 'multi' : LANGUAGE;
        
        // Start backend streaming session (no encoding needed - uses PCM16)
        streamingSessionId = await invoke('start_streaming_transcription', {
            provider: 'cartesia',
            apiKey: apiKey,
            language: streamLanguage,
            smartFormat: TEXT_FORMATTED,
            insertionMode: INSERTION_MODE,
            encoding: null,
            voiceCommandsEnabled: VOICE_COMMANDS_ENABLED
        });
        
        // Start unified audio capture (handles both visualization AND transcription)
        await startUnifiedAudioCapture('cartesia', streamingSessionId);
        
    } catch (error) {
        console.error('[Cartesia] Failed to start:', error);
        status.textContent = `Error: ${error.message}`;
        throw error;
    }
}

async function stopRecording() {
    // Immediate UI feedback
    isRecording = false;
    micButton.classList.remove('recording');
    audioVisualizer?.classList.remove('active');
    status.textContent = 'Press to record';

    // Check if using streaming provider
    const isStreaming = STREAMING_PROVIDERS.includes(API_SERVICE);

    if (isStreaming) {
        // STREAMING MODE: Stop MediaRecorder and close WebSocket
        await stopStreamingRecording();
    } else {
        // BATCH MODE: Process final segment
        await stopBatchRecording();
    }
    
    // Reset visualizer bars to default state AFTER stopping audio processing
    resetBarHeights();

    // Schedule mic release to keep device warm for quick restart
    if (micStream) {
        micReleaseTimer = setTimeout(() => {
            try {
                for (const track of micStream.getTracks()) track.stop();
            } catch (_) {}
            micStream = null;
        }, MIC_RELEASE_DELAY_MS);
    }
}

async function stopBatchRecording() {
    if (segmentationActive) {
        // Emit final segment if any
        try {
            const currentIndex = segmentSamples16k.length;
            const msSinceBoundary = ((currentIndex - segmentLastBoundary) / 16000) * 1000;
            if (segmentHadSpeech && msSinceBoundary >= SEGMENT_MIN_DURATION_MS && !segmentIsProcessing) {
                await emitSegmentIfReady(currentIndex);
            }
        } catch (_) {}
        
        // Cleanup
        try {
            if (segmentProcessor) segmentProcessor.disconnect();
        } catch (_) {}
        try {
            if (segmentSource) segmentSource.disconnect();
        } catch (_) {}
        try {
            if (segmentAudioCtx && segmentAudioCtx.state !== 'closed') await segmentAudioCtx.suspend();
        } catch (_) {}
        
        segmentProcessor = null;
        segmentSource = null;
        segmentationActive = false;
        segmentSamples16k = [];
        segmentLastBoundary = 0;
        segmentInSilenceMs = 0;
        segmentHadSpeech = false;
        segmentIsProcessing = false;
        
        // Stop visualizer
        try {
            await invoke('stop_visualizer');
        } catch (_) {}
    }
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}

async function stopStreamingRecording() {
    // Stop Deepgram MediaRecorder (if used)
    if (deepgramMediaRecorder && deepgramMediaRecorder.state !== 'inactive') {
        deepgramMediaRecorder.stop();
        deepgramMediaRecorder = null;
    }
    
    // Stop unified audio capture (handles both visualization and transcription)
    if (unifiedProcessor) {
        try {
            unifiedProcessor.disconnect();
        } catch (_) {}
        unifiedProcessor = null;
    }
    if (unifiedSource) {
        try {
            unifiedSource.disconnect();
        } catch (_) {}
        unifiedSource = null;
    }
    if (unifiedClonedStream) {
        try {
            unifiedClonedStream.getTracks().forEach(track => track.stop());
        } catch (_) {}
        unifiedClonedStream = null;
    }
    if (unifiedAudioCtx && unifiedAudioCtx.state !== 'closed') {
        try {
            await unifiedAudioCtx.suspend();
        } catch (_) {}
        unifiedAudioCtx = null;
    }
    
    // Close backend streaming session
    if (streamingSessionId) {
        try {
            await invoke('stop_streaming_transcription', {
                sessionId: streamingSessionId
            });
        } catch (error) {
            console.error('[Streaming] Failed to stop session:', error);
        }
        streamingSessionId = null;
    }
}

// Compact mode toggle functionality
const COMPACT_CLASS = 'compact-mode';
const TRANSITIONING_CLASS = 'transitioning';
const ENTER_CLASS = 'compact-enter';
const EXIT_CLASS = 'compact-exit';

async function toggleCompactMode(targetState) {
    const isCompact = document.body.classList.contains(COMPACT_CLASS);
    const shouldCompact = typeof targetState === 'boolean' ? targetState : !isCompact;
    
    if (shouldCompact === isCompact) {
        return;
    }
    
    const enteringCompact = shouldCompact;
    // Start UI transition immediately to feel snappier
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

    // Fire backend resize in parallel; revert UI on failure
    invoke('toggle_compact_mode', { enabled: shouldCompact }).catch((error) => {
        console.error('[COMPACT] Failed to toggle compact mode:', error);
        // Revert UI state if backend failed
        const revertToCompact = !enteringCompact; // reverse of target
        document.body.classList.add(TRANSITIONING_CLASS);
        document.body.classList.remove(ENTER_CLASS, EXIT_CLASS);
        document.body.classList.add(revertToCompact ? ENTER_CLASS : EXIT_CLASS);
        requestAnimationFrame(() => {
            if (revertToCompact) {
                document.body.classList.add(COMPACT_CLASS);
            } else {
                document.body.classList.remove(COMPACT_CLASS);
            }
            setTimeout(() => {
                document.body.classList.remove(TRANSITIONING_CLASS, ENTER_CLASS, EXIT_CLASS);
            }, 200);
        });
    });
}

// // Right-click to toggle compact mode
// document.body.addEventListener('contextmenu', (event) => {
//     event.preventDefault();
//     toggleCompactMode();
// });

// Listen for global shortcut (Ctrl+Shift+V) with debounce
let lastToggleTime = 0;
listen('toggle-view', () => {
    const now = Date.now();
    if (now - lastToggleTime < 300) {
        return;
    }
    lastToggleTime = now;
    toggleCompactMode();
});

// Listen for grammar correction shortcut (Ctrl+Shift+G)
let lastGrammarTime = 0;
listen('sparkle-trigger', async () => {
    const now = Date.now();
    if (now - lastGrammarTime < 300) {
        return;
    }
    lastGrammarTime = now;
    
    // Directly call grammar correction function instead of simulating click
    await performGrammarCorrection();
});

// Listen for settings changes
listen('settings-changed', async () => {
    await loadSettings();
});

// Load settings on startup
loadSettings();
loadAudioCues();

// ===== AUDIO VISUALIZER =====
// Implementation based on Handy project's approach

// Smoothed levels for frontend interpolation (prevents jitter)
let smoothedLevels = Array(9).fill(0);

/**
 * Reset visualizer bars to CSS default state (disabled/rest state)
 */
function resetBarHeights() {
    if (!audioVisualizer) return;
    
    const barElements = audioVisualizer.querySelectorAll('.bar');
    smoothedLevels = Array(9).fill(0);
    
    barElements.forEach(bar => {
        if (bar) {
            bar.style.height = '4px';
            bar.style.backgroundColor = 'rgb(68, 86, 109)';
            bar.style.opacity = '0.4';
            bar.style.transition = 'height 200ms ease-out, background-color 200ms ease-out';
        }
    });
}

/**
 * Update bar heights and opacity based on audio frequency data
 * Visual amplification of Handy's formula for better responsiveness
 * Original: height = min(20, 4 + pow(v, 0.7) * 16)
 * Amplified: height = min(35, 4 + pow(v, 0.65) * 26)
 * @param {number[]} barValues - Array of 9 values (0.0 - 1.0)
 */
function updateBarHeights(barValues) {
    if (!audioVisualizer) return;
    
    const barElements = audioVisualizer.querySelectorAll('.bar');
    
    // Apply smoothing to reduce jitter (like the reference project)
    smoothedLevels = smoothedLevels.map((prev, i) => {
        const target = barValues[i] || 0;
        return prev * 0.7 + target * 0.3; // Smooth transition: 70% old, 30% new
    });
    
    smoothedLevels.forEach((value, index) => {
        const bar = barElements[index];
        if (bar) {
            // Visually amplified formula: taller bars, more responsive to lower sounds
            const height = Math.min(35, 4 + Math.pow(value, 0.65) * 26);
            bar.style.height = `${height}px`;
            
            // Set transition for smooth animation
            bar.style.transition = 'height 60ms ease-out';
            
            // Calculate opacity based on value (minimum 0.5 for visibility)
            const opacity = Math.max(0.5, value * 2);
            
            // Calculate color from blue to light blue based on intensity
            const blue = { r: 0, g: 169, b: 255 };      //rgb(160, 200, 248)
            const lblue = { r: 160, g: 200, b: 248 };      //rgb(0, 169, 255) (accent color)
            
            const r = Math.round(blue.r + (lblue.r - blue.r) * value);
            const g = Math.round(blue.g + (lblue.g - blue.g) * value);
            const b = Math.round(blue.b + (lblue.b - blue.b) * value);
            
            bar.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
            bar.style.opacity = opacity;
        }
    });
}

// Listen for audio bar updates from backend
listen('audio-bars-update', (event) => {
    const data = event.payload;
    if (data && data.bars) {
        updateBarHeights(data.bars);
    }
});
