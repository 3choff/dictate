// Import frontend modules
import { AudioVisualizer } from './audio/audio-visualizer.js';
import { AudioCaptureManager } from './audio/audio-capture.js';
import { createProvider } from './providers/provider-factory.js';

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

// Unified audio capture manager
const audioCaptureManager = new AudioCaptureManager();
let micReleaseTimer = null;
const MIC_RELEASE_DELAY_MS = 8000; // release mic after stopping to speed up re-starts
let ignoreNextMicClick = false; // suppress click after pointerdown-start
let ignoreNextSettingsClick = false;
let ignoreNextGrammarClick = false;

// Active provider instance (replaces old branching logic)
let activeProvider = null;

const micButton = document.getElementById('micButton');
const settingsBtn = document.getElementById('settingsBtn');
const grammarBtn = document.getElementById('grammarBtn');
const closeBtnTop = document.getElementById('close-btn-top');
const closeBtnCompact = document.getElementById('close-btn-compact');
const visualizerContainer = document.getElementById('audioVisualizer');
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

// Frontend visualizer instance
let visualizer = null;

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

// Audio processing helper functions (exported for providers)
const audioHelpers = {
    dbfsFromRms(rms) {
        if (rms <= 1e-9) return -120;
        return 20 * Math.log10(rms);
    },
    
    mixToMonoFloat32(audioBuffer) {
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
    },
    
    downsampleTo16kInt16(float32Mono, inputSampleRate) {
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
    },
    
    encodeWav16kMono(int16Samples) {
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
};

function dbfsFromRms(rms) {
    return audioHelpers.dbfsFromRms(rms);
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

// Guard to prevent duplicate loads
let isLoadingSettings = false;

// Load API key from settings and restore compact mode
async function loadSettings() {
    if (isLoadingSettings) {
        console.log('[Settings] Skipping duplicate load (already in progress)');
        return;
    }
    
    isLoadingSettings = true;
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
    } finally {
        isLoadingSettings = false;
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
        visualizerContainer?.classList.add('active');
        status.textContent = 'Starting...';
        // Start asynchronously and revert if it fails
        startRecording().catch((err) => {
            console.error('Error starting recording:', err);
            isRecording = false;
            micButton.classList.remove('recording');
            visualizerContainer?.classList.remove('active');
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
        visualizerContainer?.classList.add('active');
        status.textContent = 'Starting...';
        // Start asynchronously and revert if it fails
        startRecording().catch((err) => {
            console.error('Error starting recording:', err);
            isRecording = false;
            micButton.classList.remove('recording');
            visualizerContainer?.classList.remove('active');
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
        visualizerContainer?.classList.add('active');
        status.textContent = 'Starting...';
        try {
            await startRecording();
        } catch (err) {
            console.error('Error starting recording:', err);
            isRecording = false;
            micButton.classList.remove('recording');
            visualizerContainer?.classList.remove('active');
            status.textContent = 'Microphone access denied';
        }
    } else {
        // Play stop cue (may be blocked if not a user gesture)
        playClack();
        // Stop recording
        await stopRecording();
    }
}

async function startRecording() {
    try {
        // Cancel any scheduled microphone release
        if (micReleaseTimer) {
            clearTimeout(micReleaseTimer);
            micReleaseTimer = null;
        }
        
        // Get API key for selected service
        const apiKeyMap = {
            'groq': GROQ_API_KEY,
            'gemini': GEMINI_API_KEY,
            'mistral': MISTRAL_API_KEY,
            'sambanova': SAMBANOVA_API_KEY,
            'fireworks': FIREWORKS_API_KEY,
            'deepgram': DEEPGRAM_API_KEY,
            'cartesia': CARTESIA_API_KEY
        };
        
        const apiKey = apiKeyMap[API_SERVICE];
        if (!apiKey) {
            throw new Error(`API key not configured for ${API_SERVICE}`);
        }
        
        // Create provider instance
        activeProvider = createProvider(API_SERVICE, {
            apiKey: apiKey,
            language: LANGUAGE,
            smartFormat: TEXT_FORMATTED,
            insertionMode: INSERTION_MODE,
            voiceCommandsEnabled: VOICE_COMMANDS_ENABLED,
            invoke: invoke,
            audioHelpers: audioHelpers
        });
        
        // Initialize visualizer if needed
        if (!visualizer) {
            const barElements = visualizerContainer?.querySelectorAll('.bar') || [];
            visualizer = new AudioVisualizer(barElements);
        }
        
        // Start provider (handles both audio capture and transcription)
        await activeProvider.start(audioCaptureManager, visualizer);
        
        // UI was already set by the caller for immediate feedback
        status.textContent = 'Recording...';
    } catch (error) {
        console.error('Error starting recording:', error);
        activeProvider = null;
        throw error;
    }
}

async function stopRecording() {
    // Immediate UI feedback
    isRecording = false;
    micButton.classList.remove('recording');
    visualizerContainer?.classList.remove('active');
    status.textContent = 'Press to record';

    // Stop active provider (handles transcription cleanup)
    if (activeProvider) {
        try {
            await activeProvider.stop();
        } catch (error) {
            console.error('Error stopping provider:', error);
        }
        activeProvider = null;
    }
    
    // Stop frontend visualizer
    if (visualizer) {
        visualizer.stop();
    }
    
    // Stop audio capture
    await audioCaptureManager.stop();

    // Schedule mic release to keep device warm for quick restart
    micReleaseTimer = setTimeout(() => {
        audioCaptureManager.cleanup();
    }, MIC_RELEASE_DELAY_MS);
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

// ===== VISUALIZATION =====
// Visualization is now handled entirely in the frontend using Web Audio API's AnalyserNode
// See audio-visualizer.js for implementation
