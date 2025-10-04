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
const SEGMENT_SILENCE_MS = 1000;      // 1 second of silence triggers segment
const SEGMENT_SILENCE_DB = -30;       // dB threshold for silence detection
const SEGMENT_MAX_DURATION_MS = 15000; // Max 15s per segment (safety)
const SEGMENT_MIN_DURATION_MS = 200;   // Min 200ms (ignore noise)

const micButton = document.getElementById('micButton');
const settingsBtn = document.getElementById('settingsBtn');
const grammarBtn = document.getElementById('grammarBtn');
const closeBtn = document.getElementById('close-btn');
const status = { textContent: '' }; // Dummy status object since we don't have a status element

// API key and insertion mode will be loaded from settings
let GROQ_API_KEY = '';
let INSERTION_MODE = 'typing';

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
        await invoke('transcribe_audio_segment', {
            audioData: Array.from(wavBytes),
            apiKey: GROQ_API_KEY,
            insertionMode: INSERTION_MODE
        });
    } catch (error) {
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
        INSERTION_MODE = settings.insertion_mode || 'typing';
        
        // Restore compact mode state
        if (settings.compact_mode) {
            document.body.classList.add('compact-mode');
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Toggle settings window
settingsBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
        await invoke('open_settings_window');
    } catch (error) {
        console.error('Failed to open settings:', error);
    }
});

// Close button handler - exits the app
closeBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
        await invoke('exit_app');
    } catch (error) {
        console.error('Failed to exit app:', error);
    }
});

// Handle mic button click
micButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleRecording();
});

// Listen for global shortcut with debounce to prevent double-firing
let lastShortcutTime = 0;
listen('toggle-recording', () => {
    const now = Date.now();
    if (now - lastShortcutTime < 500) return;
    lastShortcutTime = now;
    toggleRecording();
});

// Grammar correction button handler
grammarBtn.addEventListener('click', async () => {
    try {
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
        
        // Insert corrected text (this will replace the selected text via Ctrl+V)
        await invoke('insert_text', { 
            text: correctedText,
            insertionMode: INSERTION_MODE
        });
        
    } catch (error) {
        console.error('Grammar correction error:', error);
    } finally {
        grammarBtn.classList.remove('loading');
    }
});

async function toggleRecording() {
    if (!isRecording) {
        await startRecording();
    } else {
        await stopRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Use segmentation mode for non-streaming providers
        segmentationActive = true;
        segmentAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        try {
            await segmentAudioCtx.resume();
        } catch (_) {}
        
        segmentSource = segmentAudioCtx.createMediaStreamSource(stream);
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
        
        isRecording = true;
        micButton.classList.add('recording');
        status.textContent = 'Recording...';
    } catch (error) {
        console.error('Error starting recording:', error);
        status.textContent = 'Microphone access denied';
    }
}

async function stopRecording() {
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
            if (segmentAudioCtx) segmentAudioCtx.close();
        } catch (_) {}
        
        segmentProcessor = null;
        segmentSource = null;
        segmentAudioCtx = null;
        segmentationActive = false;
        segmentSamples16k = [];
        segmentLastBoundary = 0;
        segmentInSilenceMs = 0;
        segmentHadSpeech = false;
        segmentIsProcessing = false;
    }
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    
    isRecording = false;
    micButton.classList.remove('recording');
    status.textContent = 'Press to record';
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
    
    // Call backend FIRST to update window size and save preference
    try {
        await invoke('toggle_compact_mode', { enabled: shouldCompact });
    } catch (error) {
        console.error('[COMPACT] Failed to toggle compact mode:', error);
        return; // Don't update UI if backend fails
    }
    
    // Then add transition classes
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
}

// Right-click to toggle compact mode
document.body.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    toggleCompactMode();
});

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
    
    // Trigger grammar correction (same as clicking the button)
    grammarBtn.click();
});

// Listen for settings changes
listen('settings-changed', async () => {
    await loadSettings();
});

// Load settings on startup
loadSettings();
