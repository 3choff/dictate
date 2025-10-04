const { invoke } = window.__TAURI__?.core || {};
const { getCurrent } = window.__TAURI__?.window || {};

const groqApiKeyInput = document.getElementById('groqApiKey');
const toggleVisibilityBtn = document.getElementById('toggleVisibility');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const statusDiv = document.getElementById('status');

// Load settings on startup
async function loadSettings() {
    try {
        const settings = await invoke('get_settings');
        groqApiKeyInput.value = settings.groq_api_key || '';
    } catch (error) {
        console.error('Failed to load settings:', error);
        showStatus('Failed to load settings', 'error');
    }
}

// Save settings
async function saveSettings() {
    try {
        const settings = {
            groq_api_key: groqApiKeyInput.value.trim()
        };

        await invoke('save_settings', { settings });
        showStatus('Settings saved successfully!', 'success');
        
        // Close window after a short delay
        setTimeout(() => {
            getCurrent().close();
        }, 1000);
    } catch (error) {
        console.error('Failed to save settings:', error);
        showStatus('Failed to save settings', 'error');
    }
}

// Toggle password visibility
function togglePasswordVisibility() {
    const type = groqApiKeyInput.type === 'password' ? 'text' : 'password';
    groqApiKeyInput.type = type;
    toggleVisibilityBtn.textContent = type === 'password' ? '👁️' : '🙈';
}

// Show status message
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type} show`;
    
    setTimeout(() => {
        statusDiv.classList.remove('show');
    }, 3000);
}

// Event listeners
saveBtn.addEventListener('click', saveSettings);
cancelBtn.addEventListener('click', () => {
    getCurrent().close();
});
toggleVisibilityBtn.addEventListener('click', togglePasswordVisibility);

// Save on Enter key
groqApiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveSettings();
    }
});

// Load settings when page loads
loadSettings();
