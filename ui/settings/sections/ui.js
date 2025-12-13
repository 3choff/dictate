import { ToggleSwitch } from '../components/toggle-switch.js';
import { SelectField } from '../components/select-field.js';
import { Tooltip } from '../../shared/tooltip.js';
import { i18n } from '../../shared/i18n.js';

/**
 * UI settings section
 */
export class UISection {
    constructor() {
        this.darkModeToggle = new ToggleSwitch('dark-mode-enabled', i18n.t('interface.darkMode'));
        this.startHiddenToggle = new ToggleSwitch('start-hidden', i18n.t('interface.startHidden'));
        this.closeToTrayToggle = new ToggleSwitch('close-to-tray', i18n.t('interface.closeToTray'));
        this.autostartToggle = new ToggleSwitch('autostart-enabled', i18n.t('interface.autostart'));
        
        this.languageField = new SelectField('app-language-select', i18n.t('interface.language'), [
            { value: 'en', label: 'English' },
            { value: 'it', label: 'Italiano' },
            { value: 'es', label: 'Español' },
            { value: 'fr', label: 'Français' },
            { value: 'de', label: 'Deutsch' },
            { value: 'pt', label: 'Português' },
            { value: 'zh', label: '中文' },
            { value: 'ja', label: '日本語' },
            { value: 'ru', label: 'Русский' }
        ]);
    }

    render() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'ui-section';
        
        const title = document.createElement('h2');
        title.textContent = i18n.t('interface.title');
        title.className = 'section-title';
        section.appendChild(title);
        
        // Appearance group
        const appearanceGroup = document.createElement('div');
        appearanceGroup.className = 'settings-group';

        const appearanceLabel = document.createElement('div');
        appearanceLabel.className = 'settings-group-label';
        appearanceLabel.textContent = i18n.t('interface.appearance');
        appearanceGroup.appendChild(appearanceLabel);

        const appearanceBody = document.createElement('div');
        appearanceBody.className = 'settings-group-body';
        appearanceBody.appendChild(this.languageField.render());
        appearanceBody.appendChild(this.darkModeToggle.render());
        appearanceGroup.appendChild(appearanceBody);
        section.appendChild(appearanceGroup);
        
        // Behavior group
        const behaviorGroup = document.createElement('div');
        behaviorGroup.className = 'settings-group';

        const behaviorLabel = document.createElement('div');
        behaviorLabel.className = 'settings-group-label';
        behaviorLabel.textContent = i18n.t('interface.behavior');
        behaviorGroup.appendChild(behaviorLabel);

        const behaviorBody = document.createElement('div');
        behaviorBody.className = 'settings-group-body';
        behaviorBody.appendChild(this.startHiddenToggle.render());
        behaviorBody.appendChild(this.closeToTrayToggle.render());
        behaviorBody.appendChild(this.autostartToggle.render());
        behaviorGroup.appendChild(behaviorBody);
        section.appendChild(behaviorGroup);
        
        return section;
    }

    initialize(saveSettingsFn) {
        // Language - trigger save and reload on change
        this.languageField.onChange(async (value) => {
            if (saveSettingsFn) {
                await saveSettingsFn();
                window.location.reload();
            }
        });

        // Add tooltip to language label
        const languageLabel = document.querySelector('label[for="app-language-select"]');
        if (languageLabel) {
            new Tooltip(i18n.t('interface.tooltips.language'), 'top').attachTo(languageLabel);
        }
        
        // Add tooltip to dark mode toggle
        const darkModeToggleElement = document.getElementById('dark-mode-enabled');
        if (darkModeToggleElement) {
            const labelElement = darkModeToggleElement.closest('.toggle-row')?.querySelector('.toggle-label');
            if (labelElement) {
                new Tooltip(i18n.t('interface.tooltips.darkMode'), 'top').attachTo(labelElement);
            }
            
            // Handle theme change
            darkModeToggleElement.addEventListener('change', (e) => {
                this.handleThemeToggle(e.target.checked);
            });
        }
        
        // Add tooltip to start hidden toggle
        this.addTooltip('start-hidden', i18n.t('interface.tooltips.startHidden'));
        
        // Add tooltip to close to tray toggle
        this.addTooltip('close-to-tray', i18n.t('interface.tooltips.closeToTray'));
        
        // Add tooltip to autostart toggle and handle change
        const autostartToggleElement = document.getElementById('autostart-enabled');
        if (autostartToggleElement) {
            const labelElement = autostartToggleElement.closest('.toggle-row')?.querySelector('.toggle-label');
            if (labelElement) {
                new Tooltip(i18n.t('interface.tooltips.autostart'), 'top').attachTo(labelElement);
            }
            
            autostartToggleElement.addEventListener('change', (e) => {
                this.handleAutostartToggle(e.target.checked);
            });
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
        if (settings.darkModeEnabled !== undefined) {
            this.darkModeToggle.setValue(settings.darkModeEnabled);
        }
        if (settings.startHidden !== undefined) {
            this.startHiddenToggle.setValue(settings.startHidden);
        }
        if (settings.closeToTray !== undefined) {
            this.closeToTrayToggle.setValue(settings.closeToTray);
        }
        if (settings.autostartEnabled !== undefined) {
            this.autostartToggle.setValue(settings.autostartEnabled);
        }
        if (settings.appLanguage !== undefined) {
            this.languageField.setValue(settings.appLanguage);
        }
    }

    getValues() {
        return {
            darkModeEnabled: this.darkModeToggle.getValue(),
            startHidden: this.startHiddenToggle.getValue(),
            closeToTray: this.closeToTrayToggle.getValue(),
            autostartEnabled: this.autostartToggle.getValue(),
            appLanguage: this.languageField.getValue()
        };
    }
    
    handleThemeToggle(isDarkMode) {
        const theme = isDarkMode ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        if (window.__TAURI__?.core?.invoke) {
            window.__TAURI__.core.invoke('apply_theme', { theme });
        }
    }
    
    handleAutostartToggle(enabled) {
        if (window.__TAURI__?.core?.invoke) {
            window.__TAURI__.core.invoke('set_autostart_enabled', { enabled })
                .catch((error) => {
                    console.error('Failed to set autostart:', error);
                    this.autostartToggle.setValue(!enabled);
                });
        }
    }
}
