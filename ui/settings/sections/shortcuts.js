import { ShortcutInput } from '../components/shortcut-input.js';

/**
 * Keyboard Shortcuts settings section
 */
export class ShortcutsSection {
    constructor() {
        this.saveCallback = null;
        
        this.toggleRecordingInput = new ShortcutInput(
            'shortcut-toggle-recording',
            'Toggle Recording',
            'Ctrl+Shift+D',
            'Start and stop dictation'
        );
        
        this.rewriteInput = new ShortcutInput(
            'shortcut-rewrite',
            'Text Rewrite',
            'Ctrl+Shift+R',
            'Rewrite selected text (grammar, tone, style)'
        );
        
        this.toggleViewInput = new ShortcutInput(
            'shortcut-toggle-view',
            'Toggle View',
            'Ctrl+Shift+V',
            'Switch between compact and expanded mode'
        );
        
        this.toggleSettingsInput = new ShortcutInput(
            'shortcut-toggle-settings',
            'Toggle Settings',
            'Ctrl+Shift+S',
            'Open or close settings window'
        );
        
        this.toggleDebugInput = new ShortcutInput(
            'shortcut-toggle-debug',
            'Toggle Debug',
            'Ctrl+Shift+L',
            'Open or close developer tools'
        );
        
        this.closeAppInput = new ShortcutInput(
            'shortcut-close-app',
            'Close App',
            'Ctrl+Shift+X',
            'Exit Dictate application'
        );
    }

    render() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'shortcuts-section';
        
        const title = document.createElement('h2');
        title.textContent = 'Shortcuts';
        title.className = 'section-title';
        section.appendChild(title);
        
        const description = document.createElement('p');
        description.className = 'section-description';
        description.textContent = 'Customize global keyboard shortcuts.';
        section.appendChild(description);

        
        // Add all shortcut inputs
        section.appendChild(this.toggleRecordingInput.render());
        section.appendChild(this.rewriteInput.render());
        section.appendChild(this.toggleViewInput.render());
        section.appendChild(this.toggleSettingsInput.render());
        section.appendChild(this.toggleDebugInput.render());
        section.appendChild(this.closeAppInput.render());
        
        return section;
    }

    initialize() {
        // Set up onChange handlers to trigger auto-save
        const inputs = [
            this.toggleRecordingInput,
            this.rewriteInput,
            this.toggleViewInput,
            this.toggleSettingsInput,
            this.toggleDebugInput,
            this.closeAppInput
        ];
        
        inputs.forEach(input => {
            input.onChange(() => {
                if (this.saveCallback) {
                    this.saveCallback();
                }
            });
        });
    }
    
    setSaveCallback(callback) {
        this.saveCallback = callback;
    }

    loadValues(settings) {
        if (settings.keyboardShortcuts) {
            const shortcuts = settings.keyboardShortcuts;
            this.toggleRecordingInput.setValue(shortcuts.toggleRecording || '');
            this.rewriteInput.setValue(shortcuts.rewrite || '');
            this.toggleViewInput.setValue(shortcuts.toggleView || '');
            this.toggleSettingsInput.setValue(shortcuts.toggleSettings || '');
            this.toggleDebugInput.setValue(shortcuts.toggleDebug || '');
            this.closeAppInput.setValue(shortcuts.closeApp || '');
        }
    }

    getValues() {
        return {
            keyboardShortcuts: {
                toggleRecording: this.toggleRecordingInput.getValue(),
                rewrite: this.rewriteInput.getValue(),
                toggleView: this.toggleViewInput.getValue(),
                toggleSettings: this.toggleSettingsInput.getValue(),
                toggleDebug: this.toggleDebugInput.getValue(),
                closeApp: this.closeAppInput.getValue(),
            }
        };
    }
}
