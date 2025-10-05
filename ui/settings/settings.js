const { invoke } = window.__TAURI__?.core || {};
const { getCurrentWindow } = window.__TAURI__?.window || {};
// Using raw invoke for opener plugin commands to avoid requiring JS guest bindings

const groqApiKeyInput = document.getElementById('groqApiKey');
const toggleVisibilityBtn = document.getElementById('toggleVisibility');
const closeBtn = document.getElementById('close-settings-btn');
const insertionModeSelect = document.getElementById('insertion-mode');
const helpButton = document.getElementById('settings-help');

// Load settings on startup
async function loadSettings() {
    try {
        const settings = await invoke('get_settings');
        groqApiKeyInput.value = settings.groq_api_key || '';
        insertionModeSelect.value = settings.insertion_mode || 'typing';
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Save settings silently
async function saveSettings() {
    try {
        const settings = {
            groq_api_key: groqApiKeyInput.value.trim(),
            insertion_mode: insertionModeSelect.value
        };

        await invoke('save_settings', { settings });
        console.log('Settings saved');
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

// Toggle password visibility
function togglePasswordVisibility() {
    const type = groqApiKeyInput.type === 'password' ? 'text' : 'password';
    groqApiKeyInput.type = type;
}

// Close window and save
async function closeWindow() {
    await saveSettings();
    try {
        // Use the same toggle command as the main window
        await invoke('open_settings_window');
    } catch (error) {
        console.error('Failed to hide window:', error);
    }
}

// Event listeners
if (closeBtn) {
    closeBtn.addEventListener('click', async (e) => {
        console.log('Close button clicked');
        e.preventDefault();
        e.stopPropagation();
        await closeWindow();
    });
} else {
    console.error('Close button not found!');
}

if (toggleVisibilityBtn) {
    toggleVisibilityBtn.addEventListener('click', togglePasswordVisibility);
}

// Save on Enter key
if (groqApiKeyInput) {
    groqApiKeyInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            await closeWindow();
        }
    });

    // Auto-save when input changes (debounced)
    let saveTimeout;
    groqApiKeyInput.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveSettings, 500);
    });
}

// Auto-save when insertion mode changes
if (insertionModeSelect) {
    insertionModeSelect.addEventListener('change', saveSettings);
}

// Save before window closes
window.addEventListener('beforeunload', async (e) => {
    await saveSettings();
});

if (helpButton) {
    helpButton.addEventListener('click', () => {
        const url = 'https://github.com/3choff/dictate/issues';
        if (window.__TAURI__?.core?.invoke) {
            window.__TAURI__.core.invoke('plugin:opener|open_url', { url })
                .catch((error) => console.error('Failed to open help link:', error));
        }
    });
}

// Load settings when page loads
loadSettings();
