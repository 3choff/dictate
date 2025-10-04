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

const micButton = document.getElementById('micButton');
const settingsBtn = document.getElementById('settingsBtn');
const status = document.getElementById('status');

// API key will be loaded from settings
let GROQ_API_KEY = '';

console.log('Tauri available:', !!window.__TAURI__);
console.log('invoke available:', !!invoke);
console.log('listen available:', !!listen);

// Load API key from settings
async function loadSettings() {
    try {
        const settings = await invoke('get_settings');
        GROQ_API_KEY = settings.groq_api_key || '';
        if (!GROQ_API_KEY) {
            status.textContent = 'Please set API key in settings';
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Open settings window
settingsBtn.addEventListener('click', async () => {
    try {
        await invoke('open_settings_window');
    } catch (error) {
        console.error('Failed to open settings:', error);
    }
});

// Prevent focus on mousedown and handle click without stealing focus
micButton.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Trigger recording toggle without allowing default focus behavior
    toggleRecording();
});

// Listen for global shortcut with debounce to prevent double-firing
let lastShortcutTime = 0;
listen('toggle-recording', () => {
    const now = Date.now();
    if (now - lastShortcutTime < 500) {
        console.log('Ignoring duplicate shortcut event');
        return;
    }
    lastShortcutTime = now;
    toggleRecording();
});

async function toggleRecording() {
    console.log('Toggle recording called, isRecording:', isRecording);
    if (!isRecording) {
        await startRecording();
    } else {
        await stopRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioData = Array.from(new Uint8Array(arrayBuffer));
            
            status.textContent = 'Transcribing...';
            
            try {
                console.log('Sending transcription request:', {
                    audioDataLength: audioData.length,
                    hasApiKey: !!GROQ_API_KEY,
                    apiKeyLength: GROQ_API_KEY?.length
                });
                
                const text = await invoke('transcribe_audio', {
                    audioData,
                    apiKey: GROQ_API_KEY
                });
                
                if (text && text.trim()) {
                    status.textContent = 'Inserting text...';
                    await invoke('insert_text', { text: text.trim() + ' ' });
                    status.textContent = 'Done!';
                } else {
                    status.textContent = 'No speech detected';
                }
            } catch (error) {
                console.error('Error:', error);
                status.className = 'status error';
                status.textContent = 'Error: ' + error;
                // Keep error visible for 10 seconds instead of 2
                setTimeout(() => {
                    status.className = 'status';
                    status.textContent = 'Press to record';
                }, 10000);
                return; // Don't reset status after 2 seconds
            }
            
            setTimeout(() => {
                status.textContent = 'Press to record';
            }, 2000);
            
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        isRecording = true;
        micButton.classList.add('recording');
        status.textContent = 'Recording...';
    } catch (error) {
        console.error('Error starting recording:', error);
        status.textContent = 'Microphone access denied';
    }
}

async function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
        micButton.classList.remove('recording');
    }
}

// Load settings on startup
loadSettings();
