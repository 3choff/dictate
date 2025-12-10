import { SelectField } from '../components/select-field.js';
import { ToggleSwitch } from '../components/toggle-switch.js';
import { Tooltip } from '../../shared/tooltip.js';

/**
 * Customize settings section
 */
export class GeneralSection {
    constructor() {
        this.insertionModeField = new SelectField('insertion-mode', 'Insertion Mode', [
            { value: 'typing', label: 'Simulated Typing' },
            { value: 'clipboard', label: 'Clipboard' }
        ]);
        
        this.textFormattedToggle = new ToggleSwitch('text-formatted', 'Text formatted');
        this.voiceCommandsToggle = new ToggleSwitch('voice-commands-enabled', 'Voice commands');
        this.audioCuesToggle = new ToggleSwitch('audio-cues-enabled', 'Audio feedback');
        this.pushToTalkToggle = new ToggleSwitch('push-to-talk-enabled', 'Push-to-Talk');
        this.darkModeToggle = new ToggleSwitch('dark-mode-enabled', 'Dark mode');
        
        // Warning timeout tracker
        this.warningTimeout = null;
    }

    render() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'general-section';
        
        const title = document.createElement('h2');
        title.textContent = 'Customize';
        title.className = 'section-title';
        section.appendChild(title);
        
        const description = document.createElement('p');
        // description.textContent = 'Personalize Dictate’s behavior and app preferences.';
        // description.className = 'section-description';
        // section.appendChild(description);
        
        // Input group: Voice commands, Push-to-Talk
        const inputGroup = document.createElement('div');
        inputGroup.className = 'settings-group';

        const inputLabel = document.createElement('div');
        inputLabel.className = 'settings-group-label';
        inputLabel.textContent = 'Input';
        inputGroup.appendChild(inputLabel);

        const inputBody = document.createElement('div');
        inputBody.className = 'settings-group-body';
        inputBody.appendChild(this.voiceCommandsToggle.render());
        inputBody.appendChild(this.pushToTalkToggle.render());
        inputGroup.appendChild(inputBody);
        section.appendChild(inputGroup);

        // Output group: Insertion Mode, Text formatted, Audio feedback
        const outputGroup = document.createElement('div');
        outputGroup.className = 'settings-group';

        const outputLabel = document.createElement('div');
        outputLabel.className = 'settings-group-label';
        outputLabel.textContent = 'Output';
        outputGroup.appendChild(outputLabel);

        const outputBody = document.createElement('div');
        outputBody.className = 'settings-group-body';
        outputBody.appendChild(this.insertionModeField.render());
        outputBody.appendChild(this.textFormattedToggle.render());
        outputBody.appendChild(this.audioCuesToggle.render());
        outputGroup.appendChild(outputBody);
        section.appendChild(outputGroup);

        // UI group: Dark mode
        const uiGroup = document.createElement('div');
        uiGroup.className = 'settings-group';

        const uiLabel = document.createElement('div');
        uiLabel.className = 'settings-group-label';
        uiLabel.textContent = 'UI';
        uiGroup.appendChild(uiLabel);

        const uiBody = document.createElement('div');
        uiBody.className = 'settings-group-body';
        uiBody.appendChild(this.darkModeToggle.render());
        uiGroup.appendChild(uiBody);
        section.appendChild(uiGroup);
        
        // Add warning message for PTT with streaming providers
        const pttWarning = document.createElement('div');
        pttWarning.id = 'ptt-warning';
        pttWarning.className = 'setting-warning';
        pttWarning.style.display = 'none';
        pttWarning.innerHTML = `
            <span style="color: white; font-size: 0.85em; margin-left: 10px;">
                ⚠️ Push-to-Talk is only supported with batch providers (Groq, Gemini, Mistral, SambaNova, Fireworks)
            </span>
        `;
        section.appendChild(pttWarning);
        
        return section;
    }

    initialize() {
        // Add tooltip to audio feedback toggle
        const audioCuesToggleElement = document.getElementById('audio-cues-enabled');
        if (audioCuesToggleElement) {
            const labelElement = audioCuesToggleElement.closest('.toggle-row')?.querySelector('.toggle-label');
            if (labelElement) {
                const tooltip = new Tooltip('Play audio cues when recordings start and stop', 'top');
                tooltip.attachTo(labelElement);
            }
        }

        // Add tooltip to text formatted toggle
        const textFormattedToggleElement = document.getElementById('text-formatted');
        if (textFormattedToggleElement) {
            const labelElement = textFormattedToggleElement.closest('.toggle-row')?.querySelector('.toggle-label');
            if (labelElement) {
                const tooltip = new Tooltip('Apply punctuation and capitalization to transcribed text', 'top');
                tooltip.attachTo(labelElement);
            }
        }

        // Add tooltip to voice commands toggle
        const voiceCommandsToggleElement = document.getElementById('voice-commands-enabled');
        if (voiceCommandsToggleElement) {
            const labelElement = voiceCommandsToggleElement.closest('.toggle-row')?.querySelector('.toggle-label');
            if (labelElement) {
                const tooltip = new Tooltip('Enable voice commands during recording', 'top');
                tooltip.attachTo(labelElement);
            }
        }

        // Add tooltip to push-to-talk toggle
        const pushToTalkToggleElement = document.getElementById('push-to-talk-enabled');
        if (pushToTalkToggleElement) {
            const labelElement = pushToTalkToggleElement.closest('.toggle-row')?.querySelector('.toggle-label');
            if (labelElement) {
                const tooltip = new Tooltip('Hold keys shortcut to record, release to stop', 'top');
                tooltip.attachTo(labelElement);
            }
            
            // Prevent PTT toggle for streaming providers
            pushToTalkToggleElement.addEventListener('change', (e) => {
                this.handlePttToggle(e);
            });
        }
        
        // Add tooltip to dark mode toggle
        const darkModeToggleElement = document.getElementById('dark-mode-enabled');
        if (darkModeToggleElement) {
            const labelElement = darkModeToggleElement.closest('.toggle-row')?.querySelector('.toggle-label');
            if (labelElement) {
                const tooltip = new Tooltip('Switch between dark and light color scheme', 'top');
                tooltip.attachTo(labelElement);
            }
            
            // Handle theme change
            darkModeToggleElement.addEventListener('change', (e) => {
                this.handleThemeToggle(e.target.checked);
            });
        }
        
        // Initial update of PTT warning
        this.updatePttWarning();

        // Add tooltip to insertion mode label
        const insertionModeLabel = document.querySelector('#general-section .form-group:first-of-type .toggle-label, #insertion-mode-label');
        if (!insertionModeLabel) {
            const selectWrapper = document.querySelector('#general-section .form-group:first-of-type');
            if (selectWrapper) {
                const label = selectWrapper.querySelector('label');
                if (label) {
                    const tooltip = new Tooltip('Select the insertion mode of the transcribed text', 'top');
                    tooltip.attachTo(label);
                }
            }
        } else {
            const tooltip = new Tooltip('Select the insertion mode of the transcribed text', 'top');
            tooltip.attachTo(insertionModeLabel);
        }
    }

    loadValues(settings) {
        if (settings.insertionMode) {
            this.insertionModeField.setValue(settings.insertionMode);
        }
        if (settings.formatted !== undefined) {
            this.textFormattedToggle.setValue(settings.formatted);
        }
        if (settings.voiceCommandsEnabled !== undefined) {
            this.voiceCommandsToggle.setValue(settings.voiceCommandsEnabled);
        }
        if (settings.audioCuesEnabled !== undefined) {
            this.audioCuesToggle.setValue(settings.audioCuesEnabled);
        }
        if (settings.pushToTalkEnabled !== undefined) {
            this.pushToTalkToggle.setValue(settings.pushToTalkEnabled);
        }
        if (settings.darkModeEnabled !== undefined) {
            this.darkModeToggle.setValue(settings.darkModeEnabled);
        }
    }

    getValues() {
        return {
            insertionMode: this.insertionModeField.getValue(),
            formatted: this.textFormattedToggle.getValue(),
            voiceCommandsEnabled: this.voiceCommandsToggle.getValue(),
            audioCuesEnabled: this.audioCuesToggle.getValue(),
            pushToTalkEnabled: this.pushToTalkToggle.getValue(),
            darkModeEnabled: this.darkModeToggle.getValue()
        };
    }
    
    handlePttToggle(event) {
        const currentProvider = document.getElementById('api-service')?.value || 'groq';
        const streamingProviders = ['deepgram', 'cartesia'];
        const isStreamingProvider = streamingProviders.includes(currentProvider);
        
        // If trying to enable PTT with streaming provider, prevent it
        if (event.target.checked && isStreamingProvider) {
            // Prevent the toggle from being enabled
            event.preventDefault();
            event.target.checked = false;
            
            // Show warning temporarily
            this.showTemporaryWarning();
        } else {
            this.updatePttWarning();
        }
    }
    
    showTemporaryWarning() {
        const pttWarning = document.getElementById('ptt-warning');
        if (pttWarning) {
            // Show warning
            pttWarning.style.display = 'block';
            
            // Clear any existing timeout
            if (this.warningTimeout) {
                clearTimeout(this.warningTimeout);
            }
            
            // Auto-hide after 6 seconds (enough time to read)
            this.warningTimeout = setTimeout(() => {
                pttWarning.style.display = 'none';
            }, 6000);
        }
    }
    
    updatePttWarning() {
        const pttWarning = document.getElementById('ptt-warning');
        const pttToggle = document.getElementById('push-to-talk-enabled');
        const pttEnabled = pttToggle?.checked || false;
        const currentProvider = document.getElementById('api-service')?.value || 'groq';
        
        // Streaming providers that don't support PTT
        const streamingProviders = ['deepgram', 'cartesia'];
        const isStreamingProvider = streamingProviders.includes(currentProvider);
        
        // If PTT is enabled but user switched to streaming provider, disable PTT and show warning
        if (pttEnabled && isStreamingProvider && pttToggle) {
            pttToggle.checked = false;
            this.showTemporaryWarning();
            return;
        }
        
        if (pttWarning) {
            // Clear any auto-hide timeout when manually updating
            if (this.warningTimeout) {
                clearTimeout(this.warningTimeout);
                this.warningTimeout = null;
            }
            
            // Hide warning if switching to batch provider
            pttWarning.style.display = 'none';
        }
    }
    
    handleThemeToggle(isDarkMode) {
        const theme = isDarkMode ? 'dark' : 'light';
        
        // Apply theme to settings window
        document.documentElement.setAttribute('data-theme', theme);
        
        // Apply theme to main window via IPC
        if (window.__TAURI__?.core?.invoke) {
            window.__TAURI__.core.invoke('apply_theme', { theme });
        }
    }
}
