import { SelectField } from '../components/select-field.js';
import { ToggleSwitch } from '../components/toggle-switch.js';

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
        
        return section;
    }

    initialize() {
        // No dynamic behavior needed for general section
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
    }

    getValues() {
        return {
            insertionMode: this.insertionModeField.getValue(),
            formatted: this.textFormattedToggle.getValue(),
            voiceCommandsEnabled: this.voiceCommandsToggle.getValue()
        };
    }
}
