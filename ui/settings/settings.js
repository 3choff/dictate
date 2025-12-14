import { Sidebar } from './components/sidebar.js';
import { TranscriptionSection } from './sections/transcription.js';
import { RewriteSection } from './sections/rewrite.js';
import { GeneralSection } from './sections/general.js';
import { ShortcutsSection } from './sections/shortcuts.js';
import { UISection } from './sections/ui.js';
import { AboutSection } from './sections/about.js';
import { i18n } from '../shared/i18n.js';

const { invoke } = window.__TAURI__?.core || {};
const { getCurrentWindow } = window.__TAURI__?.window || {};

// State management
let isLoadingSettings = false;
let isSavingSettings = false;
let currentSection = 'general';
let sections = {}; // Will be initialized after i18n

// Sidebar navigation items with SVG icons
function getSidebarItems() {
    return [
    {
        id: 'general',
        label: i18n.t('sidebar.general'),
        icon: `<svg class="sidebar-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 7h-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M14 17H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <circle cx="17" cy="17" r="3" stroke="currentColor" stroke-width="2"></circle>
            <circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="2"></circle>
        </svg>`
    },
    {
        id: 'transcription',
        label: i18n.t('sidebar.transcription'),
        icon: `<svg class="sidebar-icon" width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.94073 1.34948C10.7047 0.902375 11.6503 0.90248 12.4143 1.34948C12.706 1.52022 12.9687 1.79124 13.3104 2.1329C13.652 2.47454 13.9231 2.73727 14.0938 3.029C14.5408 3.79301 14.5409 4.73862 14.0938 5.50257C13.9231 5.79422 13.652 6.0571 13.3104 6.39867L6.65929 13.0498C6.28065 13.4284 6.00692 13.7108 5.6654 13.9097C5.32388 14.1085 4.94312 14.2074 4.42702 14.3498L3.24391 14.6762C2.77524 14.8054 2.34535 14.9263 2.00128 14.9685C1.65193 15.0112 1.17961 15.0014 0.810733 14.6326C0.44189 14.2637 0.432076 13.7914 0.474829 13.442C0.517004 13.098 0.63787 12.668 0.767151 12.1994L1.09349 11.0163C1.23585 10.5002 1.33478 10.1194 1.53356 9.77791C1.73246 9.43639 2.01487 9.16266 2.39352 8.78402L9.04463 2.1329C9.38622 1.79132 9.64908 1.52023 9.94073 1.34948ZM15.5427 14.8399H7.5522L8.96704 13.425H15.5427V14.8399ZM3.39379 9.78429C2.96497 10.2131 2.84241 10.3437 2.75706 10.4901C2.6718 10.6366 2.61858 10.8079 2.4573 11.3926L2.13096 12.5757C2.0018 13.0439 1.92191 13.3419 1.8886 13.5536C2.10038 13.5204 2.39869 13.4417 2.86761 13.3123L4.05072 12.986C4.63541 12.8247 4.80666 12.7715 4.9532 12.6862C5.09965 12.6009 5.23019 12.4783 5.65902 12.0495L10.721 6.9865L8.45574 4.72128L3.39379 9.78429ZM11.7 2.57085C11.3774 2.38205 10.9777 2.38205 10.6551 2.57085C10.5602 2.62653 10.4487 2.72937 10.0449 3.13317L9.45601 3.72101L11.7212 5.98623L12.3101 5.3984C12.7139 4.99464 12.8168 4.88314 12.8725 4.78825C13.0612 4.46567 13.0612 4.06592 12.8725 3.74333C12.8168 3.64834 12.7145 3.53758 12.3101 3.13317C11.9057 2.72869 11.795 2.62647 11.7 2.57085Z" fill="currentColor"></path>
        </svg>`
    },
    {
        id: 'rewrite',
        label: i18n.t('sidebar.rewrite'),
        icon: `<svg class="sidebar-icon" width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.3206 1.36075C16.2973 1.15542 16.1237 1.00021 15.9171 1C15.7104 0.999789 15.5365 1.15464 15.5128 1.35993C15.365 2.64161 14.6416 3.36501 13.3599 3.51284C13.1546 3.53652 12.9998 3.71044 13 3.91708C13.0002 4.12373 13.1554 4.29733 13.3608 4.32059C14.6243 4.4637 15.3978 5.18014 15.5118 6.4628C15.5304 6.67271 15.7064 6.83357 15.9171 6.83333C16.1279 6.8331 16.3035 6.67184 16.3217 6.46189C16.4311 5.19736 17.1974 4.43112 18.4619 4.32166C18.6718 4.30348 18.8331 4.12787 18.8333 3.91712C18.8336 3.70638 18.6727 3.5304 18.4628 3.51176C17.1801 3.39782 16.4637 2.62425 16.3206 1.36075Z" fill="currentColor"></path>
            <path d="M9.50016 3C9.53056 7.05405 12.9459 10.4786 17 10.4999C12.9459 10.4999 9.53056 13.9459 9.50016 18C9.46975 13.9459 6.05405 10.4999 2 10.4999C6.05405 10.4999 9.46975 7.05405 9.50016 3Z" stroke="currentColor" stroke-width="1.33" stroke-linejoin="round"></path>
        </svg>`
    },
    {
        id: 'shortcuts',
        label: i18n.t('sidebar.shortcuts'),
        icon: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
            <g id="SVGRepo_iconCarrier"> <path d="M17.5 5.00006H6.5C5.37366 4.93715 4.2682 5.32249 3.42505 6.07196C2.5819 6.82143 2.06958 7.87411 2 9.00006V15.0001C2.06958 16.126 2.5819 17.1787 3.42505 17.9282C4.2682 18.6776 5.37366 19.0628 6.5 18.9999H17.5C18.6263 19.0628 19.7319 18.6776 20.575 17.9282C21.4182 17.1787 21.9304 16.126 22 15.0001V9.00006C21.9304 7.87411 21.4182 6.82143 20.575 6.07196C19.7319 5.32249 18.6263 4.93715 17.5 5.00006V5.00006Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> 
            <path d="M6 15H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M6 12H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M6 9H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M11 12H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M11 9H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M16 12H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M16 9H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>`
    },
    {
        id: 'ui',
        label: i18n.t('sidebar.ui'),
        icon: `<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M3.77 15.56L7.23 19.02C9.66 21.45 10.49 21.41 12.89 19.02L18.46 13.45C20.4 11.51 20.89 10.22 18.46 7.78996L15 4.32996C12.41 1.73996 11.28 2.38996 9.34 4.32996L3.77 9.89996C1.38 12.3 1.18 12.97 3.77 15.56Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M19.2 16.79L18.54 17.88C17.61 19.43 18.33 20.7 20.14 20.7C21.95 20.7 22.67 19.43 21.74 17.88L21.08 16.79C20.56 15.93 19.71 15.93 19.2 16.79Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M2 12.2401C7.56 10.7301 13.42 10.6801 19 12.1101L19.5 12.2401" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>`
    },
    {
        id: 'about',
        label: i18n.t('sidebar.about'),
        icon: `<svg class="sidebar-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></circle>
            <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></line>
            <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></line>
        </svg>`
    }
];
}

function createSections() {
    sections = {
        general: new GeneralSection(),
        transcription: new TranscriptionSection(),
        rewrite: new RewriteSection(),
        shortcuts: new ShortcutsSection(),
        ui: new UISection(),
        about: new AboutSection()
    };
}

// Initialize UI
function initializeUI() {
    // Create and render sidebar
    const sidebar = new Sidebar(getSidebarItems(), handleSectionChange);
    document.getElementById('sidebar-container').appendChild(sidebar.render());
    
    // Render all sections (initially hidden)
    const contentContainer = document.getElementById('content-container');
    Object.entries(sections).forEach(([id, section]) => {
        const sectionEl = section.render();
        sectionEl.style.display = id === currentSection ? 'block' : 'none';
        contentContainer.appendChild(sectionEl);
    });
    
    // Initialize sections after DOM insertion
    Object.entries(sections).forEach(([id, section]) => {
        if (section.initialize) {
            if (id === 'transcription') {
                section.initialize(sections.general);
            } else if (id === 'ui') {
                section.initialize(saveSettings); // Pass save function to UI
            } else {
                section.initialize();
            }
        }
    });
    
    setupEventListeners();
    setupApiKeySync();
    updateFooterVisibility();
}

// Handle section navigation
function handleSectionChange(sectionId) {
    if (sectionId === currentSection) return;
    
    const currentEl = document.getElementById(`${currentSection}-section`);
    if (currentEl) currentEl.style.display = 'none';
    
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

function setupApiKeySync() {
    const sharedProviders = ['groq', 'gemini', 'mistral', 'sambanova', 'fireworks'];
    
    sharedProviders.forEach(provider => {
        const transcriptionField = sections.transcription.apiKeyFields[provider];
        const rewriteField = sections.rewrite.apiKeyFields[provider];
        
        if (transcriptionField && rewriteField) {
            transcriptionField.onChange((value) => {
                const rewriteInput = document.getElementById('rewrite' + provider.charAt(0).toUpperCase() + provider.slice(1) + 'ApiKey');
                if (rewriteInput) rewriteInput.value = value;
            });
            rewriteField.onChange((value) => {
                transcriptionField.setValue(value);
            });
        }
    });
}

function setupEventListeners() {
    const closeBtn = document.getElementById('close-settings-btn');
    closeBtn.addEventListener('click', async () => {
        await saveSettings();
        getCurrentWindow().close();
    });
    
    const openExternal = (url, errorMessage) => {
        if (window.__TAURI__?.core?.invoke) {
            window.__TAURI__.core.invoke('plugin:opener|open_url', { url })
                .catch((error) => console.error(errorMessage, error));
        }
    };
    const openHelp = () => openExternal('https://github.com/3choff/dictate/issues', 'Failed to open help link:');
    const openDonate = () => openExternal('https://ko-fi.com/3choff', 'Failed to open support link:');
    
    const updateNotice = document.getElementById('update-notice');
    const aboutUpdateNotice = document.getElementById('about-update-notice');
    const openReleasesPage = () => {
        const url = 'https://github.com/3choff/dictate/releases';
        openExternal(url, 'Failed to open releases link:');
    };
    
    if (updateNotice) {
        updateNotice.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation(); openReleasesPage();
        });
        updateNotice.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
    }

    if (aboutUpdateNotice) {
        aboutUpdateNotice.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation(); openReleasesPage();
        });
        aboutUpdateNotice.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
    }

    const aboutSourceButton = document.getElementById('about-source-code');
    if (aboutSourceButton) {
        aboutSourceButton.addEventListener('click', () => {
            openExternal('https://github.com/3choff/dictate', 'Failed to open source link:');
        });
    }

    const donateButton = document.getElementById('settings-donate');
    if (donateButton) donateButton.addEventListener('click', openDonate);

    const aboutDonateButton = document.getElementById('about-donate');
    if (aboutDonateButton) aboutDonateButton.addEventListener('click', openDonate);

    const aboutHelpButton = document.getElementById('about-help');
    if (aboutHelpButton) aboutHelpButton.addEventListener('click', openHelp);
    
    // Auto-save
    let saveTimeout;
    const debouncedSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => saveSettings(), 500);
    };
    
    document.addEventListener('change', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
            // Compact mode toggle is handled separately by its own command
            if (e.target.id === 'compact-mode-enabled') return;
            debouncedSave();
        }
    });
    document.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            debouncedSave();
        }
    });
}

// Load settings from backend
async function loadSettings(loadedSettings) {
    if (isLoadingSettings) return;
    
    isLoadingSettings = true;
    try {
        const settings = loadedSettings || await invoke('get_settings');
        
        const normalizedSettings = {
            provider: settings.api_service || 'groq',
            language: settings.transcription_language || 'multilingual',
            appLanguage: settings.app_language || 'en',
            rewriteProvider: settings.rewrite_provider || 'groq',
            rewriteMode: settings.rewrite_mode || 'grammar_correction',
            customRewritePrompt: settings.custom_rewrite_prompt || '',
            insertionMode: settings.insertion_mode || 'typing',
            formatted: settings.text_formatted !== false,
            voiceCommandsEnabled: settings.voice_commands_enabled !== false,
            audioCuesEnabled: settings.audio_cues_enabled !== false,
            pushToTalkEnabled: settings.push_to_talk_enabled || false,
            darkModeEnabled: settings.dark_mode_enabled !== false,
            startHidden: settings.start_hidden || false,
            closeToTray: settings.close_to_tray !== false,
            autostartEnabled: settings.autostart_enabled || false,
            compactMode: settings.compact_mode || false,
            groqApiKey: settings.groq_api_key || '',
            deepgramApiKey: settings.deepgram_api_key || '',
            cartesiaApiKey: settings.cartesia_api_key || '',
            geminiApiKey: settings.gemini_api_key || '',
            mistralApiKey: settings.mistral_api_key || '',
            sambanovaApiKey: settings.sambanova_api_key || '',
            fireworksApiKey: settings.fireworks_api_key || '',
            keyboardShortcuts: {
                toggleRecording: settings.keyboard_shortcuts?.toggle_recording || 'Ctrl+Shift+D',
                rewrite: settings.keyboard_shortcuts?.rewrite || 'Ctrl+Shift+R',
                toggleView: settings.keyboard_shortcuts?.toggle_view || 'Ctrl+Shift+V',
                toggleSettings: settings.keyboard_shortcuts?.toggle_settings || 'Ctrl+Shift+S',
                toggleDebug: settings.keyboard_shortcuts?.toggle_debug || 'Ctrl+Shift+L',
                closeApp: settings.keyboard_shortcuts?.close_app || 'Ctrl+Shift+X'
            },
            customWords: settings.custom_words || [],
            wordCorrectionThreshold: settings.word_correction_threshold ?? 0.18,
            wordCorrectionEnabled: settings.word_correction_enabled ?? true,
            prompts: settings.prompts || {}
        };
        
        sections.transcription.loadValues(normalizedSettings);
        sections.rewrite.loadValues(normalizedSettings);
        sections.general.loadValues(normalizedSettings);
        sections.shortcuts.loadValues(normalizedSettings);
        sections.ui.loadValues(normalizedSettings);
        
        const theme = normalizedSettings.darkModeEnabled ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        if (invoke) {
            invoke('apply_theme', { theme });
        }
        
        console.log('[Settings] Loaded settings:', {
            provider: normalizedSettings.provider,
            rewriteProvider: normalizedSettings.rewriteProvider,
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
    if (isSavingSettings || isLoadingSettings || !sections.ui) return;
    
    isSavingSettings = true;
    try {
        const transcriptionValues = sections.transcription.getValues();
        const rewriteValues = sections.rewrite.getValues();
        const generalValues = sections.general.getValues();
        const shortcutValues = sections.shortcuts.getValues();
        const uiValues = sections.ui.getValues();
        
        const settings = {
            api_service: transcriptionValues.provider,
            transcription_language: transcriptionValues.language,
            app_language: uiValues.appLanguage,
            rewrite_provider: rewriteValues.rewriteProvider,
            rewrite_mode: rewriteValues.rewriteMode,
            custom_rewrite_prompt: rewriteValues.customRewritePrompt,
            insertion_mode: generalValues.insertionMode,
            text_formatted: generalValues.formatted,
            voice_commands_enabled: generalValues.voiceCommandsEnabled,
            audio_cues_enabled: generalValues.audioCuesEnabled,
            push_to_talk_enabled: generalValues.pushToTalkEnabled,
            dark_mode_enabled: uiValues.darkModeEnabled,
            start_hidden: uiValues.startHidden,
            close_to_tray: uiValues.closeToTray,
            autostart_enabled: uiValues.autostartEnabled,
            groq_api_key: transcriptionValues.groqApiKey || rewriteValues.groqApiKey || '',
            deepgram_api_key: transcriptionValues.deepgramApiKey || '',
            cartesia_api_key: transcriptionValues.cartesiaApiKey || '',
            gemini_api_key: transcriptionValues.geminiApiKey || rewriteValues.geminiApiKey || '',
            mistral_api_key: transcriptionValues.mistralApiKey || rewriteValues.mistralApiKey || '',
            sambanova_api_key: transcriptionValues.sambanovaApiKey || rewriteValues.sambanovaApiKey || '',
            fireworks_api_key: transcriptionValues.fireworksApiKey || rewriteValues.fireworksApiKey || '',
            keyboard_shortcuts: {
                toggle_recording: shortcutValues.keyboardShortcuts.toggleRecording,
                rewrite: shortcutValues.keyboardShortcuts.rewrite,
                toggle_view: shortcutValues.keyboardShortcuts.toggleView,
                toggle_settings: shortcutValues.keyboardShortcuts.toggleSettings,
                toggle_debug: shortcutValues.keyboardShortcuts.toggleDebug,
                close_app: shortcutValues.keyboardShortcuts.closeApp
            },
            custom_words: transcriptionValues.customWords || [],
            word_correction_threshold: transcriptionValues.wordCorrectionThreshold ?? 0.18,
            word_correction_enabled: transcriptionValues.wordCorrectionEnabled ?? true
        };
        
        await invoke('save_settings', { settings });
        await invoke('reregister_shortcuts');
        
        console.log('[Settings] Saved:', {
            provider: settings.api_service,
            rewriteProvider: settings.rewrite_provider,
            closeToTray: settings.close_to_tray,
            hasGroqKey: !!settings.groq_api_key,
            hasGeminiKey: !!settings.gemini_api_key
        });
    } catch (error) {
        console.error('[Settings] Failed to save:', error);
    } finally {
        isSavingSettings = false;
    }
}

// ... checkForUpdates, cmpSemver, createCustomSelect ...
async function checkForUpdates() {
    // ... same as before
    try {
        const versionLabel = document.getElementById('app-version');
        const updateNotice = document.getElementById('update-notice');
        const aboutVersion = document.getElementById('about-version');
        const aboutUpdateNotice = document.getElementById('about-update-notice');
        
        if (!versionLabel || !window.__TAURI__?.core?.invoke) return;
        
        const currentVersion = await invoke('get_app_version');
        if (currentVersion) {
            versionLabel.textContent = `v${currentVersion}`;
            if (aboutVersion) aboutVersion.textContent = `v${currentVersion}`;
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

function cmpSemver(a, b) {
    const aParts = a.replace(/^v/, '').split('.').map(Number);
    const bParts = b.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (aParts[i] > bParts[i]) return 1;
        if (aParts[i] < bParts[i]) return -1;
    }
    return 0;
}

function createCustomSelect(selectElement) {
    // ... same as before ...
     const selectWrapper = document.createElement('div');
    selectWrapper.className = 'custom-select-wrapper';

    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.innerHTML = `<span></span><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon-sm"><path d="M12.1338 5.94433C12.3919 5.77382 12.7434 5.80202 12.9707 6.02929C13.1979 6.25656 13.2261 6.60807 13.0556 6.8662L12.9707 6.9707L8.47067 11.4706C8.21097 11.7303 7.78896 11.7303 7.52926 11.4706L3.02926 6.9707L2.9443 6.8662C2.77379 6.60807 2.80199 6.25656 3.02926 6.02929C3.25653 5.80202 3.60804 5.77382 3.86617 5.94433L3.97067 6.02929L7.99996 10.0586L12.0293 6.02929L12.1338 5.94433Z"></path></svg>`;
    selectWrapper.appendChild(trigger);
    
    // ... rest of custom select implementation ...
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
    if (selectedOption) trigger.querySelector('span').textContent = selectedOption.textContent;

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
            selectElement.value = e.target.dataset.value;
            trigger.querySelector('span').textContent = e.target.textContent;
            options.classList.remove('open');
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

function initializeCustomSelects() {
    document.querySelectorAll('.custom-select').forEach(createCustomSelect);
}

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
    const settings = await invoke('get_settings');
    
    // Initialize i18n
    await i18n.init(settings.app_language);
    
    // Create UI sections (using i18n)
    createSections();
    
    initializeUI();
    await loadSettings(settings);
    initializeCustomSelects();
    await checkForUpdates();
    
    // Listen for toggle-view events (from keyboard shortcut) to sync compact mode toggle
    const { listen } = window.__TAURI__?.event || {};
    if (listen && sections.ui) {
        listen('toggle-view', async () => {
            // Small delay to ensure main window has saved the setting
            await new Promise(r => setTimeout(r, 100));
            // Fetch the new compact mode state and update toggle
            try {
                const newSettings = await invoke('get_settings');
                sections.ui.compactModeToggle.setValue(newSettings.compact_mode || false);
            } catch (e) {
                console.error('Failed to sync compact mode toggle:', e);
            }
        });
    }
});
