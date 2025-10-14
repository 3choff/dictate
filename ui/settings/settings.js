const { invoke } = window.__TAURI__?.core || {};
const { getCurrentWindow } = window.__TAURI__?.window || {};
// Using raw invoke for opener plugin commands to avoid requiring JS guest bindings

const groqApiKeyInput = document.getElementById('groqApiKey');
const toggleVisibilityBtn = document.getElementById('toggleVisibility');
const closeBtn = document.getElementById('close-settings-btn');
const insertionModeSelect = document.getElementById('insertion-mode');
const languageSelect = document.getElementById('language-select');
const textFormattedCheckbox = document.getElementById('text-formatted');
const voiceCommandsCheckbox = document.getElementById('voice-commands-enabled');
const helpButton = document.getElementById('settings-help');
const versionLabel = document.getElementById('app-version');
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
const cartesiaApiKeyInput = document.getElementById('cartesiaApiKey');
const toggleCartesiaVisibilityBtn = document.getElementById('toggleCartesiaVisibility');
const cartesiaKeyGroup = document.getElementById('cartesia-key-group');
const groqKeyGroup = document.getElementById('groq-key-group');


let isLoadingSettings = false;
let isSavingSettings = false;

// Load settings on startup
async function loadSettings() {
    if (isLoadingSettings) {
        console.log('[Settings] Skipping duplicate load (already in progress)');
        return;
    }
    
    isLoadingSettings = true;
    try {
        const settings = await invoke('get_settings');
        groqApiKeyInput.value = settings.groq_api_key || '';
        if (sambaApiKeyInput) sambaApiKeyInput.value = settings.sambanova_api_key || '';
        if (fireworksApiKeyInput) fireworksApiKeyInput.value = settings.fireworks_api_key || '';
        if (geminiApiKeyInput) geminiApiKeyInput.value = settings.gemini_api_key || '';
        if (mistralApiKeyInput) mistralApiKeyInput.value = settings.mistral_api_key || '';
        if (deepgramApiKeyInput) deepgramApiKeyInput.value = settings.deepgram_api_key || '';
        if (cartesiaApiKeyInput) cartesiaApiKeyInput.value = settings.cartesia_api_key || '';
        if (apiServiceSelect) apiServiceSelect.value = settings.api_service || 'groq';
        insertionModeSelect.value = settings.insertion_mode || 'typing';
        if (languageSelect) {
            languageSelect.value = settings.language || 'multilingual';
        }
        
        if (textFormattedCheckbox) {
            textFormattedCheckbox.checked = settings.text_formatted !== false;  // Default true
        }
        if (voiceCommandsCheckbox) {
            voiceCommandsCheckbox.checked = settings.voice_commands_enabled !== false;  // Default true
        }
        if (grammarProviderSelect) {
            grammarProviderSelect.value = settings.grammar_provider || 'groq';
        }

        // Update custom select displays to match loaded values
        updateCustomSelectDisplays();

        // Update provider key visibility
        updateProviderVisibility();
        
        console.log('[Settings UI] Loaded & displayed: provider=' + (settings.api_service || 'groq') + 
                    ' lang=' + (settings.language || 'multilingual') + 
                    ' formatted=' + (settings.text_formatted !== false) + 
                    ' voiceCmds=' + (settings.voice_commands_enabled !== false));
    } catch (error) {
        console.error('[Settings] Failed to load settings:', error);
    } finally {
        isLoadingSettings = false;
    }
}

// Update custom select trigger text to match the actual select value
function updateCustomSelectDisplays() {
    document.querySelectorAll('.custom-select').forEach(select => {
        const wrapper = select.closest('.custom-select-wrapper');
        if (wrapper) {
            const trigger = wrapper.querySelector('.custom-select-trigger span');
            const selectedOption = select.options[select.selectedIndex];
            if (trigger && selectedOption) {
                trigger.textContent = selectedOption.textContent;
            }
        }
    });
}

// Save settings silently
async function saveSettings() {
    if (isSavingSettings) {
        console.log('[Settings] Skipping duplicate save (already in progress)');
        return;
    }
    
    isSavingSettings = true;
    try {
        // Load current settings first to preserve fields we don't manage in UI
        const currentSettings = await invoke('get_settings');
        
        // Merge UI values with current settings to preserve compact_mode and window position
        const settings = {
            ...currentSettings,  // Preserve all existing fields (compact_mode, main_window_position, etc.)
            groq_api_key: groqApiKeyInput.value.trim(),
            sambanova_api_key: sambaApiKeyInput ? sambaApiKeyInput.value.trim() : '',
            fireworks_api_key: fireworksApiKeyInput ? fireworksApiKeyInput.value.trim() : '',
            gemini_api_key: geminiApiKeyInput ? geminiApiKeyInput.value.trim() : '',
            mistral_api_key: mistralApiKeyInput ? mistralApiKeyInput.value.trim() : '',
            deepgram_api_key: deepgramApiKeyInput ? deepgramApiKeyInput.value.trim() : '',
            cartesia_api_key: cartesiaApiKeyInput ? cartesiaApiKeyInput.value.trim() : '',
            api_service: apiServiceSelect ? apiServiceSelect.value : 'groq',
            grammar_provider: grammarProviderSelect ? grammarProviderSelect.value : 'groq',
            insertion_mode: insertionModeSelect.value,
            language: languageSelect ? languageSelect.value : 'multilingual',
            text_formatted: textFormattedCheckbox ? textFormattedCheckbox.checked : true,
            voice_commands_enabled: voiceCommandsCheckbox ? voiceCommandsCheckbox.checked : true
        };

        await invoke('save_settings', { settings });
        console.log('[Settings UI] Saved: provider=' + settings.api_service + 
                    ' mode=' + settings.insertion_mode + 
                    ' lang=' + settings.language + 
                    ' formatted=' + settings.text_formatted + 
                    ' voiceCmds=' + settings.voice_commands_enabled +
                    ' (preserved compact_mode=' + settings.compact_mode + 
                    ' position=' + (settings.main_window_position ? 'yes' : 'no') + ')');
    } catch (error) {
        console.error('[Settings] Failed to save settings:', error);
    } finally {
        isSavingSettings = false;
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

function toggleCartesiaPasswordVisibility() {
    if (!cartesiaApiKeyInput) return;
    const type = cartesiaApiKeyInput.type === 'password' ? 'text' : 'password';
    cartesiaApiKeyInput.type = type;
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
    if (cartesiaKeyGroup) cartesiaKeyGroup.style.display = 'none';
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
    } else if (svc === 'cartesia' && cartesiaKeyGroup) {
        cartesiaKeyGroup.style.display = '';
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
if (toggleCartesiaVisibilityBtn) {
    toggleCartesiaVisibilityBtn.addEventListener('click', toggleCartesiaPasswordVisibility);
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

// Auto-save when voice commands toggle changes
if (voiceCommandsCheckbox) {
    voiceCommandsCheckbox.addEventListener('change', saveSettings);
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

// Auto-save when Cartesia key changes (debounced)
if (cartesiaApiKeyInput) {
    let saveTimeout7;
    cartesiaApiKeyInput.addEventListener('input', () => {
        clearTimeout(saveTimeout7);
        saveTimeout7 = setTimeout(saveSettings, 500);
    });
}

function createCustomSelect(selectElement) {
    const selectWrapper = document.createElement('div');
    selectWrapper.className = 'custom-select-wrapper';

    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.innerHTML = `<span></span><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon-sm"><path d="M12.1338 5.94433C12.3919 5.77382 12.7434 5.80202 12.9707 6.02929C13.1979 6.25656 13.2261 6.60807 13.0556 6.8662L12.9707 6.9707L8.47067 11.4707C8.21097 11.7304 7.78896 11.7304 7.52926 11.4707L3.02926 6.9707L2.9443 6.8662C2.77379 6.60807 2.80199 6.25656 3.02926 6.02929C3.25653 5.80202 3.60804 5.77382 3.86617 5.94433L3.97067 6.02929L7.99996 10.0586L12.0293 6.02929L12.1338 5.94433Z"></path></svg>`;
    selectWrapper.appendChild(trigger);

    const options = document.createElement('div');
    options.className = 'custom-options';

    Array.from(selectElement.options).forEach(option => {
        const optionEl = document.createElement('div');
        optionEl.className = 'custom-option';
        optionEl.textContent = option.textContent;
        optionEl.dataset.value = option.value;
        options.appendChild(optionEl);
    });

    selectWrapper.appendChild(options);
    selectElement.parentNode.insertBefore(selectWrapper, selectElement);
    selectWrapper.appendChild(selectElement); // Move the original select inside
    selectElement.style.display = 'none'; // Hide it

    // Set initial text
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    trigger.querySelector('span').textContent = selectedOption.textContent;

    // Event Listeners
    trigger.addEventListener('click', () => {
        const isOpen = options.classList.toggle('open');

        if (isOpen) {
            const rect = trigger.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const optionsHeight = options.scrollHeight;

            // Reset styles first
            options.style.maxHeight = '';
            options.style.overflowY = '';

            if (optionsHeight > spaceBelow - 10) { // 10px buffer
                options.style.maxHeight = (spaceBelow - 10) + 'px';
                options.style.overflowY = 'auto';
            }
        }
    });

    options.addEventListener('click', (e) => {
        if (e.target.classList.contains('custom-option')) {
            const selectedValue = e.target.dataset.value;
            selectElement.value = selectedValue;
            trigger.querySelector('span').textContent = e.target.textContent;
            options.classList.remove('open');
            
            // Manually trigger a change event for auto-saving
            selectElement.dispatchEvent(new Event('change'));
        }
    });
}

// Close all custom dropdowns when clicking outside
window.addEventListener('click', (e) => {
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        if (!wrapper.contains(e.target)) {
            wrapper.querySelector('.custom-options').classList.remove('open');
        }
    });
});

document.querySelectorAll('.custom-select').forEach(createCustomSelect);

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

// Fetch and render app version in footer
(async () => {
    try {
        if (versionLabel && window.__TAURI__?.core?.invoke) {
            const version = await invoke('get_app_version');
            if (version) versionLabel.textContent = `v${version}`;
            await hydrateUpdateNotice(version);
        }
    } catch (e) {
        console.error('Failed to get app version:', e);
    }
})();

// Bind update notice click using the same opener approach as Help
const updateNoticeEl = document.getElementById('update-notice');
function openReleasesPage() {
    const url = 'https://github.com/3choff/dictate/releases';
    console.log('[update-notice] Opening releases:', url);
    if (window.__TAURI__?.core?.invoke) {
        window.__TAURI__.core.invoke('plugin:opener|open_url', { url })
            .catch((error) => console.error('Failed to open releases link:', error));
    }
}
if (updateNoticeEl) {
    updateNoticeEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openReleasesPage();
    });
    updateNoticeEl.addEventListener('pointerdown', (e) => {
        // Capture early to avoid drag swallowing click
        e.preventDefault();
        e.stopPropagation();
        openReleasesPage();
    });
    updateNoticeEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openReleasesPage();
        }
    });
}

// Global capture fallback (in case direct listener is bypassed by drag regions)
document.addEventListener('pointerdown', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const el = target.closest('#update-notice');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    openReleasesPage();
}, true);

function parseSemver(v) {
    const s = String(v || '').trim().replace(/^v/gi, '');
    const [maj, min, pat] = s.split('.');
    return [parseInt(maj || '0', 10), parseInt(min || '0', 10), parseInt(pat || '0', 10)];
}

function cmpSemver(a, b) {
    const aa = parseSemver(a), bb = parseSemver(b);
    for (let i = 0; i < 3; i++) {
        if ((aa[i] || 0) > (bb[i] || 0)) return 1;
        if ((aa[i] || 0) < (bb[i] || 0)) return -1;
    }
    return 0;
}

function setUpdateVisible(visible) {
    const el = document.getElementById('update-notice');
    if (!el) return;
    el.style.display = visible ? 'inline' : 'none';
}

async function hydrateUpdateNotice(currentVersion) {
    try {
        // Ask backend for per-run cached latest tag; it will fetch once per app session
        const tag = await invoke('get_latest_release_tag'); // may be null
        console.log('Version check - Current:', currentVersion, 'Latest:', tag);
        if (tag && cmpSemver(tag, currentVersion) === 1) {
            console.log('Update available, showing notice');
            setUpdateVisible(true);
        } else {
            console.log('No update available');
            setUpdateVisible(false);
        }
    } catch (e) {
        console.error('Failed to check for updates:', e);
        setUpdateVisible(false);
    }
}
