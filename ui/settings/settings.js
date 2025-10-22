import { Sidebar } from './components/sidebar.js';
import { TranscriptionSection } from './sections/transcription.js';
import { GrammarSection } from './sections/grammar.js';
import { GeneralSection } from './sections/general.js';
import { ShortcutsSection } from './sections/shortcuts.js';
import { AboutSection } from './sections/about.js';

const { invoke } = window.__TAURI__?.core || {};
const { getCurrentWindow } = window.__TAURI__?.window || {};

// State management
let isLoadingSettings = false;
let isSavingSettings = false;
let currentSection = 'general';

// Initialize sections
const sections = {
    general: new GeneralSection(),
    transcription: new TranscriptionSection(),
    grammar: new GrammarSection(),
    shortcuts: new ShortcutsSection(),
    about: new AboutSection()
};

// Sidebar navigation items with SVG icons
const sidebarItems = [
    {
        id: 'general',
        label: 'Customize',
        icon: `<svg class="sidebar-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 7h-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M14 17H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <circle cx="17" cy="17" r="3" stroke="currentColor" stroke-width="2"></circle>
            <circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="2"></circle>
        </svg>`
    },
    {
        id: 'transcription',
        label: 'Transcription',
        icon: `<svg class="sidebar-icon" width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.94073 1.34948C10.7047 0.902375 11.6503 0.90248 12.4143 1.34948C12.706 1.52022 12.9687 1.79124 13.3104 2.1329C13.652 2.47454 13.9231 2.73727 14.0938 3.029C14.5408 3.79301 14.5409 4.73862 14.0938 5.50257C13.9231 5.79422 13.652 6.0571 13.3104 6.39867L6.65929 13.0498C6.28065 13.4284 6.00692 13.7108 5.6654 13.9097C5.32388 14.1085 4.94312 14.2074 4.42702 14.3498L3.24391 14.6762C2.77524 14.8054 2.34535 14.9263 2.00128 14.9685C1.65193 15.0112 1.17961 15.0014 0.810733 14.6326C0.44189 14.2637 0.432076 13.7914 0.474829 13.442C0.517004 13.098 0.63787 12.668 0.767151 12.1994L1.09349 11.0163C1.23585 10.5002 1.33478 10.1194 1.53356 9.77791C1.73246 9.43639 2.01487 9.16266 2.39352 8.78402L9.04463 2.1329C9.38622 1.79132 9.64908 1.52023 9.94073 1.34948ZM15.5427 14.8399H7.5522L8.96704 13.425H15.5427V14.8399ZM3.39379 9.78429C2.96497 10.2131 2.84241 10.3437 2.75706 10.4901C2.6718 10.6366 2.61858 10.8079 2.4573 11.3926L2.13096 12.5757C2.0018 13.0439 1.92191 13.3419 1.8886 13.5536C2.10038 13.5204 2.39869 13.4417 2.86761 13.3123L4.05072 12.986C4.63541 12.8247 4.80666 12.7715 4.9532 12.6862C5.09965 12.6009 5.23019 12.4783 5.65902 12.0495L10.721 6.9865L8.45574 4.72128L3.39379 9.78429ZM11.7 2.57085C11.3774 2.38205 10.9777 2.38205 10.6551 2.57085C10.5602 2.62653 10.4487 2.72937 10.0449 3.13317L9.45601 3.72101L11.7212 5.98623L12.3101 5.3984C12.7139 4.99464 12.8168 4.88314 12.8725 4.78825C13.0612 4.46567 13.0612 4.06592 12.8725 3.74333C12.8168 3.64834 12.7145 3.53758 12.3101 3.13317C11.9057 2.72869 11.795 2.62647 11.7 2.57085Z" fill="currentColor"></path>
        </svg>`
    },
    {
        id: 'grammar',
        label: 'Grammar',
        icon: `<svg class="sidebar-icon" width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.3206 1.36075C16.2973 1.15542 16.1237 1.00021 15.9171 1C15.7104 0.999789 15.5365 1.15464 15.5128 1.35993C15.365 2.64161 14.6416 3.36501 13.3599 3.51284C13.1546 3.53652 12.9998 3.71044 13 3.91708C13.0002 4.12373 13.1554 4.29733 13.3608 4.32059C14.6243 4.4637 15.3978 5.18014 15.5118 6.4628C15.5304 6.67271 15.7064 6.83357 15.9171 6.83333C16.1279 6.8331 16.3035 6.67184 16.3217 6.46189C16.4311 5.19736 17.1974 4.43112 18.4619 4.32166C18.6718 4.30348 18.8331 4.12787 18.8333 3.91712C18.8336 3.70638 18.6727 3.5304 18.4628 3.51176C17.1801 3.39782 16.4637 2.62425 16.3206 1.36075Z" fill="currentColor"></path>
            <path d="M9.50016 3C9.53056 7.05405 12.9459 10.4786 17 10.4999C12.9459 10.4999 9.53056 13.9459 9.50016 18C9.46975 13.9459 6.05405 10.4999 2 10.4999C6.05405 10.4999 9.46975 7.05405 9.50016 3Z" stroke="currentColor" stroke-width="1.33" stroke-linejoin="round"></path>
        </svg>`
    },
    {
        id: 'shortcuts',
        label: 'Shortcuts',
        // icon: `<svg class="sidebar-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        //     <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
        //     <path d="M7 9h2M7 13h2M11 9h2M11 13h2M15 9h2M15 13h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        // </svg>`
        icon: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
            <g id="SVGRepo_iconCarrier"> <path d="M17.5 5.00006H6.5C5.37366 4.93715 4.2682 5.32249 3.42505 6.07196C2.5819 6.82143 2.06958 7.87411 2 9.00006V15.0001C2.06958 16.126 2.5819 17.1787 3.42505 17.9282C4.2682 18.6776 5.37366 19.0628 6.5 18.9999H17.5C18.6263 19.0628 19.7319 18.6776 20.575 17.9282C21.4182 17.1787 21.9304 16.126 22 15.0001V9.00006C21.9304 7.87411 21.4182 6.82143 20.575 6.07196C19.7319 5.32249 18.6263 4.93715 17.5 5.00006V5.00006Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> 
            <path d="M6 15H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M6 12H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M6 9H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M11 12H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M11 9H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M16 12H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M16 9H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>`
    },
    {
        id: 'about',
        label: 'About',
        icon: `<svg class="sidebar-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></circle>
            <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></line>
            <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></line>
        </svg>`
    }
];

// Initialize UI
function initializeUI() {
    // Create and render sidebar
    const sidebar = new Sidebar(sidebarItems, handleSectionChange);
    document.getElementById('sidebar-container').appendChild(sidebar.render());
    
    // Render all sections (initially hidden)
    const contentContainer = document.getElementById('content-container');
    Object.entries(sections).forEach(([id, section]) => {
        const sectionEl = section.render();
        sectionEl.style.display = id === currentSection ? 'block' : 'none';
        contentContainer.appendChild(sectionEl);
    });
    
    // Initialize sections after DOM insertion (sets up onChange listeners)
    Object.values(sections).forEach(section => {
        if (section.initialize) {
            section.initialize();
        }
    });
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup API key syncing between transcription and grammar sections
    setupApiKeySync();

    updateFooterVisibility();
}

// Handle section navigation
function handleSectionChange(sectionId) {
    if (sectionId === currentSection) return;
    
    // Hide current section
    const currentEl = document.getElementById(`${currentSection}-section`);
    if (currentEl) currentEl.style.display = 'none';
    
    // Show new section
    const newEl = document.getElementById(`${sectionId}-section`);
    if (newEl) newEl.style.display = 'block';
    
    currentSection = sectionId;

    updateFooterVisibility();
}

function updateFooterVisibility() {
    const footer = document.querySelector('.settings-footer');
    if (!footer) return;
    footer.style.display = currentSection === 'about' ? 'none' : 'flex';
}

// Setup API key syncing between transcription and grammar sections
function setupApiKeySync() {
    // Shared providers between transcription and grammar
    const sharedProviders = ['groq', 'gemini', 'mistral', 'sambanova', 'fireworks'];
    
    sharedProviders.forEach(provider => {
        const transcriptionField = sections.transcription.apiKeyFields[provider];
        const grammarField = sections.grammar.apiKeyFields[provider];
        
        if (transcriptionField && grammarField) {
            // Sync from transcription to grammar
            transcriptionField.onChange((value) => {
                // Update the actual DOM element for grammar field
                const grammarInput = document.getElementById('grammar' + provider.charAt(0).toUpperCase() + provider.slice(1) + 'ApiKey');
                if (grammarInput) grammarInput.value = value;
            });
            
            // Sync from grammar to transcription
            grammarField.onChange((value) => {
                transcriptionField.setValue(value);
            });
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Close button
    const closeBtn = document.getElementById('close-settings-btn');
    closeBtn.addEventListener('click', async () => {
        await saveSettings();
        getCurrentWindow().close();
    });
    
    // External link helpers
    const openExternal = (url, errorMessage) => {
        if (window.__TAURI__?.core?.invoke) {
            window.__TAURI__.core.invoke('plugin:opener|open_url', { url })
                .catch((error) => console.error(errorMessage, error));
        }
    };
    const openHelp = () => openExternal('https://github.com/3choff/dictate/issues', 'Failed to open help link:');
    const openDonate = () => openExternal('https://ko-fi.com/3choff', 'Failed to open support link:');
    
    // Update notice
    const updateNotice = document.getElementById('update-notice');
    const aboutUpdateNotice = document.getElementById('about-update-notice');
    const openReleasesPage = () => {
        const url = 'https://github.com/3choff/dictate/releases';
        console.log('[update-notice] Opening releases:', url);
        openExternal(url, 'Failed to open releases link:');
    };
    
    if (updateNotice) {
        updateNotice.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openReleasesPage();
        });
        updateNotice.addEventListener('pointerdown', (e) => {
            // Capture early to avoid drag swallowing click
            e.preventDefault();
            e.stopPropagation();
        });
    }

    if (aboutUpdateNotice) {
        aboutUpdateNotice.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openReleasesPage();
        });
        aboutUpdateNotice.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    }

    const aboutSourceButton = document.getElementById('about-source-code');
    if (aboutSourceButton) {
        aboutSourceButton.addEventListener('click', () => {
            openExternal('https://github.com/3choff/dictate', 'Failed to open source link:');
        });
    }

    const donateButton = document.getElementById('settings-donate');
    if (donateButton) {
        donateButton.addEventListener('click', openDonate);
    }

    const aboutDonateButton = document.getElementById('about-donate');
    if (aboutDonateButton) {
        aboutDonateButton.addEventListener('click', openDonate);
    }
    
    // Auto-save on input changes (debounced)
    let saveTimeout;
    const debouncedSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => saveSettings(), 500);
    };
    
    // Add change and input listeners to all inputs
    document.addEventListener('change', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            console.log('[Settings] Change detected:', e.target.id);
            debouncedSave();
        }
    });
    
    document.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT') {
            console.log('[Settings] Input detected:', e.target.id);
            debouncedSave();
        }
    });
}

// Load settings from backend
async function loadSettings() {
    if (isLoadingSettings) {
        console.log('[Settings] Skipping duplicate load');
        return;
    }
    
    isLoadingSettings = true;
    try {
        const settings = await invoke('get_settings');
        
        // Convert snake_case to camelCase
        const normalizedSettings = {
            provider: settings.api_service || 'groq',
            language: settings.language || 'multilingual',
            grammarProvider: settings.grammar_provider || 'groq',
            insertionMode: settings.insertion_mode || 'typing',
            formatted: settings.text_formatted !== false,
            voiceCommandsEnabled: settings.voice_commands_enabled !== false,
            audioCuesEnabled: settings.audio_cues_enabled !== false,
            groqApiKey: settings.groq_api_key || '',
            deepgramApiKey: settings.deepgram_api_key || '',
            cartesiaApiKey: settings.cartesia_api_key || '',
            geminiApiKey: settings.gemini_api_key || '',
            mistralApiKey: settings.mistral_api_key || '',
            sambanovaApiKey: settings.sambanova_api_key || '',
            fireworksApiKey: settings.fireworks_api_key || '',
            keyboardShortcuts: {
                toggleRecording: settings.keyboard_shortcuts?.toggle_recording || 'Ctrl+Shift+D',
                grammarCorrection: settings.keyboard_shortcuts?.grammar_correction || 'Ctrl+Shift+G',
                toggleView: settings.keyboard_shortcuts?.toggle_view || 'Ctrl+Shift+V',
                toggleSettings: settings.keyboard_shortcuts?.toggle_settings || 'Ctrl+Shift+S',
                toggleDebug: settings.keyboard_shortcuts?.toggle_debug || 'Ctrl+Shift+L',
                closeApp: settings.keyboard_shortcuts?.close_app || 'Ctrl+Shift+X'
            }
        };
        
        // Load values into sections
        sections.transcription.loadValues(normalizedSettings);
        sections.grammar.loadValues(normalizedSettings);
        sections.general.loadValues(normalizedSettings);
        sections.shortcuts.loadValues(normalizedSettings);
        
        console.log('[Settings] Loaded settings:', {
            provider: normalizedSettings.provider,
            grammarProvider: normalizedSettings.grammarProvider,
            hasGroqKey: !!normalizedSettings.groqApiKey,
            hasGeminiKey: !!normalizedSettings.geminiApiKey
        });
    } catch (error) {
        console.error('[Settings] Failed to load:', error);
    } finally {
        isLoadingSettings = false;
    }
}

// Save settings to backend
async function saveSettings() {
    if (isSavingSettings || isLoadingSettings) {
        return;
    }
    
    isSavingSettings = true;
    try {
        // Collect values from all sections
        const transcriptionValues = sections.transcription.getValues();
        const grammarValues = sections.grammar.getValues();
        const generalValues = sections.general.getValues();
        const shortcutValues = sections.shortcuts.getValues();
        
        // Convert to snake_case for backend
        const settings = {
            api_service: transcriptionValues.provider,
            language: transcriptionValues.language,
            grammar_provider: grammarValues.grammarProvider,
            insertion_mode: generalValues.insertionMode,
            text_formatted: generalValues.formatted,
            voice_commands_enabled: generalValues.voiceCommandsEnabled,
            audio_cues_enabled: generalValues.audioCuesEnabled,
            groq_api_key: transcriptionValues.groqApiKey || grammarValues.groqApiKey || '',
            deepgram_api_key: transcriptionValues.deepgramApiKey || '',
            cartesia_api_key: transcriptionValues.cartesiaApiKey || '',
            gemini_api_key: transcriptionValues.geminiApiKey || grammarValues.geminiApiKey || '',
            mistral_api_key: transcriptionValues.mistralApiKey || grammarValues.mistralApiKey || '',
            sambanova_api_key: transcriptionValues.sambanovaApiKey || grammarValues.sambanovaApiKey || '',
            fireworks_api_key: transcriptionValues.fireworksApiKey || grammarValues.fireworksApiKey || '',
            keyboard_shortcuts: {
                toggle_recording: shortcutValues.keyboardShortcuts.toggleRecording,
                grammar_correction: shortcutValues.keyboardShortcuts.grammarCorrection,
                toggle_view: shortcutValues.keyboardShortcuts.toggleView,
                toggle_settings: shortcutValues.keyboardShortcuts.toggleSettings,
                toggle_debug: shortcutValues.keyboardShortcuts.toggleDebug,
                close_app: shortcutValues.keyboardShortcuts.closeApp
            }
        };
        
        await invoke('save_settings', { settings });
        
        // Re-register shortcuts if they changed
        await invoke('reregister_shortcuts');
        
        console.log('[Settings] Saved:', {
            provider: settings.api_service,
            grammarProvider: settings.grammar_provider,
            hasGroqKey: !!settings.groq_api_key,
            hasGeminiKey: !!settings.gemini_api_key
        });
    } catch (error) {
        console.error('[Settings] Failed to save:', error);
    } finally {
        isSavingSettings = false;
    }
}

// Version check
async function checkForUpdates() {
    try {
        const versionLabel = document.getElementById('app-version');
        const updateNotice = document.getElementById('update-notice');
        const aboutVersion = document.getElementById('about-version');
        const aboutUpdateNotice = document.getElementById('about-update-notice');
        
        if (!versionLabel || !window.__TAURI__?.core?.invoke) {
            return;
        }
        
        const currentVersion = await invoke('get_app_version');
        if (currentVersion) {
            versionLabel.textContent = `v${currentVersion}`;
            if (aboutVersion) {
                aboutVersion.textContent = `v${currentVersion}`;
            }
        } else if (aboutVersion) {
            aboutVersion.textContent = '—';
        }
        
        // Ask backend for per-run cached latest tag
        const tag = await invoke('get_latest_release_tag');
        console.log('[Settings] Version check - Current:', currentVersion, 'Latest:', tag);
        
        if (tag && cmpSemver(tag, currentVersion) === 1) {
            console.log('[Settings] Update available, showing notice');
            if (updateNotice) updateNotice.style.display = 'inline';
            if (aboutUpdateNotice) aboutUpdateNotice.style.display = 'inline';
        } else {
            if (updateNotice) updateNotice.style.display = 'none';
            if (aboutUpdateNotice) aboutUpdateNotice.style.display = 'none';
        }
    } catch (error) {
        console.error('[Settings] Version check failed:', error);
        const updateNotice = document.getElementById('update-notice');
        if (updateNotice) updateNotice.style.display = 'none';
        const aboutVersion = document.getElementById('about-version');
        if (aboutVersion) {
            aboutVersion.textContent = '—';
        }
        const aboutUpdateNotice = document.getElementById('about-update-notice');
        if (aboutUpdateNotice) aboutUpdateNotice.style.display = 'none';
    }
}

// Semantic version comparison
function cmpSemver(a, b) {
    const aParts = a.replace(/^v/, '').split('.').map(Number);
    const bParts = b.replace(/^v/, '').split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
        if (aParts[i] > bParts[i]) return 1;
        if (aParts[i] < bParts[i]) return -1;
    }
    return 0;
}

// Custom select dropdown implementation
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
    selectWrapper.appendChild(selectElement);
    selectElement.style.display = 'none';

    // Set initial text
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    trigger.querySelector('span').textContent = selectedOption.textContent;

    // Event Listeners
    trigger.addEventListener('click', () => {
        const isOpen = options.classList.toggle('open');

        if (isOpen) {
            const rect = trigger.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const optionsHeight = options.scrollHeight;

            // Use fixed positioning to escape overflow clipping
            options.style.position = 'fixed';
            options.style.left = rect.left + 'px';
            options.style.width = rect.width + 'px';
            options.style.maxHeight = '';
            options.style.overflowY = '';

            // If not enough space below, position above
            if (optionsHeight > spaceBelow - 10 && spaceAbove > spaceBelow) {
                options.style.bottom = (window.innerHeight - rect.top + 2) + 'px';
                options.style.top = 'auto';
                
                // Add scrolling if still too tall
                if (optionsHeight > spaceAbove - 10) {
                    options.style.maxHeight = (spaceAbove - 10) + 'px';
                    options.style.overflowY = 'auto';
                }
            } else {
                // Position below
                options.style.top = (rect.bottom + 2) + 'px';
                options.style.bottom = 'auto';
                
                // Add scrolling if needed
                if (optionsHeight > spaceBelow - 10) {
                    options.style.maxHeight = (spaceBelow - 10) + 'px';
                    options.style.overflowY = 'auto';
                }
            }
        } else {
            // Reset to absolute positioning when closed
            options.style.position = '';
            options.style.left = '';
            options.style.width = '';
            options.style.top = '';
            options.style.bottom = '';
        }
    });

    options.addEventListener('click', (e) => {
        if (e.target.classList.contains('custom-option')) {
            const selectedValue = e.target.dataset.value;
            selectElement.value = selectedValue;
            trigger.querySelector('span').textContent = e.target.textContent;
            options.classList.remove('open');
            
            // Manually trigger a change event for auto-saving (must bubble for document listener)
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

// Initialize custom selects after DOM is ready
function initializeCustomSelects() {
    document.querySelectorAll('.custom-select').forEach(createCustomSelect);
}

// Close all custom dropdowns when clicking outside
window.addEventListener('click', (e) => {
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        if (!wrapper.contains(e.target)) {
            const optionsEl = wrapper.querySelector('.custom-options');
            if (optionsEl) optionsEl.classList.remove('open');
        }
    });
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    initializeUI();
    await loadSettings();
    initializeCustomSelects();
    await checkForUpdates();
});
