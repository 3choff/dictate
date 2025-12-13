import { ShortcutInput } from '../components/shortcut-input.js';
import { i18n } from '../../shared/i18n.js';

/**
 * Keyboard Shortcuts settings section
 */
export class ShortcutsSection {
    constructor() {
        this.saveCallback = null;
        
        this.toggleRecordingInput = new ShortcutInput(
            'shortcut-toggle-recording',
            i18n.t('shortcuts.toggleRecording'),
            'Ctrl+Shift+D',
            i18n.t('shortcuts.tooltips.toggleRecording')
        );
        
        this.rewriteInput = new ShortcutInput(
            'shortcut-rewrite',
            i18n.t('shortcuts.rewrite'),
            'Ctrl+Shift+R',
            i18n.t('shortcuts.tooltips.rewrite')
        );
        
        this.toggleViewInput = new ShortcutInput(
            'shortcut-toggle-view',
            i18n.t('shortcuts.toggleView'),
            'Ctrl+Shift+V',
            i18n.t('shortcuts.tooltips.toggleView')
        );
        
        this.toggleSettingsInput = new ShortcutInput(
            'shortcut-toggle-settings',
            i18n.t('shortcuts.toggleSettings'),
            'Ctrl+Shift+S',
            i18n.t('shortcuts.tooltips.toggleSettings')
        );
        
        this.toggleDebugInput = new ShortcutInput(
            'shortcut-toggle-debug',
            i18n.t('shortcuts.toggleDebug'),
            'Ctrl+Shift+L',
            i18n.t('shortcuts.tooltips.toggleDebug')
        );
        
        this.closeAppInput = new ShortcutInput(
            'shortcut-close-app',
            i18n.t('shortcuts.closeApp'),
            'Ctrl+Shift+X',
            i18n.t('shortcuts.tooltips.closeApp')
        );
    }

    render() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'shortcuts-section';
        
        const title = document.createElement('h2');
        title.textContent = i18n.t('shortcuts.title');
        title.className = 'section-title';
        section.appendChild(title);
        
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
