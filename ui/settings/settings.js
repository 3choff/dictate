const { invoke } = window.__TAURI__?.core || {};
const { getCurrentWindow } = window.__TAURI__?.window || {};
// Using raw invoke for opener plugin commands to avoid requiring JS guest bindings

const groqApiKeyInput = document.getElementById('groqApiKey');
const toggleVisibilityBtn = document.getElementById('toggleVisibility');
const closeBtn = document.getElementById('close-settings-btn');
const insertionModeSelect = document.getElementById('insertion-mode');
const languageSelect = document.getElementById('language-select');
const textFormattedCheckbox = document.getElementById('text-formatted');
const helpButton = document.getElementById('settings-help');
const apiServiceSelect = document.getElementById('api-service');
const grammarProviderSelect = document.getElementById('grammar-provider');
const sambaApiKeyInput = document.getElementById('sambanovaApiKey');
const toggleSambaVisibilityBtn = document.getElementById('toggleSambaVisibility');
const sambaKeyGroup = document.getElementById('sambanova-key-group');
const fireworksApiKeyInput = document.getElementById('fireworksApiKey');
const toggleFireworksVisibilityBtn = document.getElementById('toggleFireworksVisibility');
const fireworksKeyGroup = document.getElementById('fireworks-key-group');
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const toggleGeminiVisibilityBtn = document.getElementById('toggleGeminiVisibility');
const geminiKeyGroup = document.getElementById('gemini-key-group');
const mistralApiKeyInput = document.getElementById('mistralApiKey');
const toggleMistralVisibilityBtn = document.getElementById('toggleMistralVisibility');
const mistralKeyGroup = document.getElementById('mistral-key-group');
const deepgramApiKeyInput = document.getElementById('deepgramApiKey');
const toggleDeepgramVisibilityBtn = document.getElementById('toggleDeepgramVisibility');
const deepgramKeyGroup = document.getElementById('deepgram-key-group');
const groqKeyGroup = document.getElementById('groq-key-group');

// Load settings on startup
async function loadSettings() {
    try {
        const settings = await invoke('get_settings');
        groqApiKeyInput.value = settings.groq_api_key || '';
        if (sambaApiKeyInput) sambaApiKeyInput.value = settings.sambanova_api_key || '';
        if (fireworksApiKeyInput) fireworksApiKeyInput.value = settings.fireworks_api_key || '';
        if (geminiApiKeyInput) geminiApiKeyInput.value = settings.gemini_api_key || '';
        if (mistralApiKeyInput) mistralApiKeyInput.value = settings.mistral_api_key || '';
        if (deepgramApiKeyInput) deepgramApiKeyInput.value = settings.deepgram_api_key || '';
        if (apiServiceSelect) apiServiceSelect.value = settings.api_service || 'groq';
        insertionModeSelect.value = settings.insertion_mode || 'typing';
        if (languageSelect) {
            languageSelect.value = settings.language || 'multilingual';
        }
        if (textFormattedCheckbox) {
            textFormattedCheckbox.checked = settings.text_formatted !== false;  // Default true
        }
        if (grammarProviderSelect) {
            grammarProviderSelect.value = settings.grammar_provider || 'groq';
        }

        // Update provider key visibility
        updateProviderVisibility();
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Save settings silently
async function saveSettings() {
    try {
        const settings = {
            groq_api_key: groqApiKeyInput.value.trim(),
            sambanova_api_key: sambaApiKeyInput ? sambaApiKeyInput.value.trim() : '',
            fireworks_api_key: fireworksApiKeyInput ? fireworksApiKeyInput.value.trim() : '',
            gemini_api_key: geminiApiKeyInput ? geminiApiKeyInput.value.trim() : '',
            mistral_api_key: mistralApiKeyInput ? mistralApiKeyInput.value.trim() : '',
            deepgram_api_key: deepgramApiKeyInput ? deepgramApiKeyInput.value.trim() : '',
            api_service: apiServiceSelect ? apiServiceSelect.value : 'groq',
            grammar_provider: grammarProviderSelect ? grammarProviderSelect.value : 'groq',
            insertion_mode: insertionModeSelect.value,
            language: languageSelect ? languageSelect.value : 'multilingual',
            text_formatted: textFormattedCheckbox ? textFormattedCheckbox.checked : true
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

function toggleSambaPasswordVisibility() {
    if (!sambaApiKeyInput) return;
    const type = sambaApiKeyInput.type === 'password' ? 'text' : 'password';
    sambaApiKeyInput.type = type;
}

function toggleFireworksPasswordVisibility() {
    if (!fireworksApiKeyInput) return;
    const type = fireworksApiKeyInput.type === 'password' ? 'text' : 'password';
    fireworksApiKeyInput.type = type;
}

function toggleGeminiPasswordVisibility() {
    if (!geminiApiKeyInput) return;
    const type = geminiApiKeyInput.type === 'password' ? 'text' : 'password';
    geminiApiKeyInput.type = type;
}

function toggleMistralPasswordVisibility() {
    if (!mistralApiKeyInput) return;
    const type = mistralApiKeyInput.type === 'password' ? 'text' : 'password';
    mistralApiKeyInput.type = type;
}

function toggleDeepgramPasswordVisibility() {
    if (!deepgramApiKeyInput) return;
    const type = deepgramApiKeyInput.type === 'password' ? 'text' : 'password';
    deepgramApiKeyInput.type = type;
}

function updateProviderVisibility() {
    if (!apiServiceSelect) return;
    const svc = apiServiceSelect.value;
    // Hide all key groups first
    if (groqKeyGroup) groqKeyGroup.style.display = 'none';
    if (sambaKeyGroup) sambaKeyGroup.style.display = 'none';
    if (fireworksKeyGroup) fireworksKeyGroup.style.display = 'none';
    if (geminiKeyGroup) geminiKeyGroup.style.display = 'none';
    if (mistralKeyGroup) mistralKeyGroup.style.display = 'none';
    if (deepgramKeyGroup) deepgramKeyGroup.style.display = 'none';
    // Show the relevant one
    if (svc === 'sambanova' && sambaKeyGroup) {
        sambaKeyGroup.style.display = '';
    } else if (svc === 'fireworks' && fireworksKeyGroup) {
        fireworksKeyGroup.style.display = '';
    } else if (svc === 'gemini' && geminiKeyGroup) {
        geminiKeyGroup.style.display = '';
    } else if (svc === 'mistral' && mistralKeyGroup) {
        mistralKeyGroup.style.display = '';
    } else if (svc === 'deepgram' && deepgramKeyGroup) {
        deepgramKeyGroup.style.display = '';
    } else if (groqKeyGroup) {
        groqKeyGroup.style.display = '';
    }
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
if (toggleSambaVisibilityBtn) {
    toggleSambaVisibilityBtn.addEventListener('click', toggleSambaPasswordVisibility);
}
if (toggleFireworksVisibilityBtn) {
    toggleFireworksVisibilityBtn.addEventListener('click', toggleFireworksPasswordVisibility);
}
if (toggleGeminiVisibilityBtn) {
    toggleGeminiVisibilityBtn.addEventListener('click', toggleGeminiPasswordVisibility);
}
if (toggleMistralVisibilityBtn) {
    toggleMistralVisibilityBtn.addEventListener('click', toggleMistralPasswordVisibility);
}
if (toggleDeepgramVisibilityBtn) {
    toggleDeepgramVisibilityBtn.addEventListener('click', toggleDeepgramPasswordVisibility);
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

// Auto-save when language changes
if (languageSelect) {
    languageSelect.addEventListener('change', saveSettings);
}

// Auto-save when grammar provider changes
if (grammarProviderSelect) {
    grammarProviderSelect.addEventListener('change', saveSettings);
}

// Auto-save when text formatted toggle changes
if (textFormattedCheckbox) {
    textFormattedCheckbox.addEventListener('change', saveSettings);
}
if (apiServiceSelect) {
    apiServiceSelect.addEventListener('change', () => {
        updateProviderVisibility();
        saveSettings();
    });
}

// Auto-save when SambaNova key changes (debounced)
if (sambaApiKeyInput) {
    let saveTimeout2;
    sambaApiKeyInput.addEventListener('input', () => {
        clearTimeout(saveTimeout2);
        saveTimeout2 = setTimeout(saveSettings, 500);
    });
}

// Auto-save when Fireworks key changes (debounced)
if (fireworksApiKeyInput) {
    let saveTimeout3;
    fireworksApiKeyInput.addEventListener('input', () => {
        clearTimeout(saveTimeout3);
        saveTimeout3 = setTimeout(saveSettings, 500);
    });
}

// Auto-save when Gemini key changes (debounced)
if (geminiApiKeyInput) {
    let saveTimeout4;
    geminiApiKeyInput.addEventListener('input', () => {
        clearTimeout(saveTimeout4);
        saveTimeout4 = setTimeout(saveSettings, 500);
    });
}

// Auto-save when Mistral key changes (debounced)
if (mistralApiKeyInput) {
    let saveTimeout5;
    mistralApiKeyInput.addEventListener('input', () => {
        clearTimeout(saveTimeout5);
        saveTimeout5 = setTimeout(saveSettings, 500);
    });
}

// Auto-save when Deepgram key changes (debounced)
if (deepgramApiKeyInput) {
    let saveTimeout6;
    deepgramApiKeyInput.addEventListener('input', () => {
        clearTimeout(saveTimeout6);
        saveTimeout6 = setTimeout(saveSettings, 500);
    });
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
