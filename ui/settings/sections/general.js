import { SelectField } from '../components/select-field.js';
import { ToggleSwitch } from '../components/toggle-switch.js';
import { Tooltip } from '../components/tooltip.js';

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
        
        section.appendChild(this.insertionModeField.render());
        section.appendChild(this.textFormattedToggle.render());
        section.appendChild(this.voiceCommandsToggle.render());
        section.appendChild(this.audioCuesToggle.render());
        
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
    }

    getValues() {
        return {
            insertionMode: this.insertionModeField.getValue(),
            formatted: this.textFormattedToggle.getValue(),
            voiceCommandsEnabled: this.voiceCommandsToggle.getValue(),
            audioCuesEnabled: this.audioCuesToggle.getValue()
        };
    }
}
