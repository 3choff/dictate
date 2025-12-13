import { SelectField } from '../components/select-field.js';
import { ToggleSwitch } from '../components/toggle-switch.js';
import { Tooltip } from '../../shared/tooltip.js';
import { i18n } from '../../shared/i18n.js';

/**
 * Customize settings section
 */
export class GeneralSection {
    constructor() {
        this.insertionModeField = new SelectField('insertion-mode', i18n.t('general.insertionMode'), [
            { value: 'typing', label: i18n.t('general.typing') },
            { value: 'clipboard', label: i18n.t('general.clipboard') }
        ]);
        
        this.textFormattedToggle = new ToggleSwitch('text-formatted', i18n.t('general.textFormatted'));
        this.voiceCommandsToggle = new ToggleSwitch('voice-commands-enabled', i18n.t('general.voiceCommands'));
        this.audioCuesToggle = new ToggleSwitch('audio-cues-enabled', i18n.t('general.audioCues'));
        this.pushToTalkToggle = new ToggleSwitch('push-to-talk-enabled', i18n.t('general.pushToTalk'));
        
        this.warningTimeout = null;
    }

    render() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'general-section';
        
        const title = document.createElement('h2');
        title.textContent = i18n.t('general.title');
        title.className = 'section-title';
        section.appendChild(title);
        
        // Input group
        const inputGroup = document.createElement('div');
        inputGroup.className = 'settings-group';

        const inputLabel = document.createElement('div');
        inputLabel.className = 'settings-group-label';
        inputLabel.textContent = i18n.t('general.input');
        inputGroup.appendChild(inputLabel);

        const inputBody = document.createElement('div');
        inputBody.className = 'settings-group-body';
        inputBody.appendChild(this.voiceCommandsToggle.render());
        inputBody.appendChild(this.pushToTalkToggle.render());
        inputGroup.appendChild(inputBody);
        section.appendChild(inputGroup);

        // Output group
        const outputGroup = document.createElement('div');
        outputGroup.className = 'settings-group';

        const outputLabel = document.createElement('div');
        outputLabel.className = 'settings-group-label';
        outputLabel.textContent = i18n.t('general.output');
        outputGroup.appendChild(outputLabel);

        const outputBody = document.createElement('div');
        outputBody.className = 'settings-group-body';
        outputBody.appendChild(this.insertionModeField.render());
        outputBody.appendChild(this.textFormattedToggle.render());
        outputBody.appendChild(this.audioCuesToggle.render());
        outputGroup.appendChild(outputBody);
        section.appendChild(outputGroup);
        
        // Add warning message
        const pttWarning = document.createElement('div');
        pttWarning.id = 'ptt-warning';
        pttWarning.className = 'setting-warning';
        pttWarning.style.display = 'none';
        pttWarning.innerHTML = `
            <span style="color: white; font-size: 0.85em; margin-left: 10px;">
                ⚠️ ${i18n.t('general.pttWarning')}
            </span>
        `;
        section.appendChild(pttWarning);
        
        return section;
    }

    initialize() {
        this.addTooltip('audio-cues-enabled', i18n.t('general.tooltips.audioCues'));
        this.addTooltip('text-formatted', i18n.t('general.tooltips.textFormatted'));
        this.addTooltip('voice-commands-enabled', i18n.t('general.tooltips.voiceCommands'));
        
        const pushToTalkToggleElement = document.getElementById('push-to-talk-enabled');
        if (pushToTalkToggleElement) {
            this.addTooltip('push-to-talk-enabled', i18n.t('general.tooltips.pushToTalk'));
            pushToTalkToggleElement.addEventListener('change', (e) => {
                this.handlePttToggle(e);
            });
        }
        
        this.updatePttWarning();

        const validSelectors = ['#general-section .form-group:first-of-type .toggle-label', '#insertion-mode-label', '#general-section .form-group:first-of-type label'];
        for (const sel of validSelectors) {
             const el = document.querySelector(sel);
             if (el) {
                 new Tooltip(i18n.t('general.tooltips.insertionMode'), 'top').attachTo(el);
                 break;
             }
        }
    }
    
    addTooltip(id, text) {
        const el = document.getElementById(id);
        if (el) {
             const label = el.closest('.toggle-row')?.querySelector('.toggle-label');
             if (label) new Tooltip(text, 'top').attachTo(label);
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
    }

    getValues() {
        return {
            insertionMode: this.insertionModeField.getValue(),
            formatted: this.textFormattedToggle.getValue(),
            voiceCommandsEnabled: this.voiceCommandsToggle.getValue(),
            audioCuesEnabled: this.audioCuesToggle.getValue(),
            pushToTalkEnabled: this.pushToTalkToggle.getValue()
        };
    }
    
    handlePttToggle(event) {
        const currentProvider = document.getElementById('api-service')?.value || 'groq';
        const streamingProviders = ['deepgram', 'cartesia'];
        const isStreamingProvider = streamingProviders.includes(currentProvider);
        
        if (event.target.checked && isStreamingProvider) {
            event.preventDefault();
            event.target.checked = false;
            this.showTemporaryWarning();
        } else {
            this.updatePttWarning();
        }
    }
    
    showTemporaryWarning() {
        const pttWarning = document.getElementById('ptt-warning');
        if (pttWarning) {
            pttWarning.style.display = 'block';
            if (this.warningTimeout) {
                clearTimeout(this.warningTimeout);
            }
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
        
        const streamingProviders = ['deepgram', 'cartesia'];
        const isStreamingProvider = streamingProviders.includes(currentProvider);
        
        if (pttEnabled && isStreamingProvider && pttToggle) {
            pttToggle.checked = false;
            this.showTemporaryWarning();
            return;
        }
        
        if (pttWarning) {
            if (this.warningTimeout) {
                clearTimeout(this.warningTimeout);
                this.warningTimeout = null;
            }
            pttWarning.style.display = 'none';
        }
    }
}
