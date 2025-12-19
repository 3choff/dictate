import { SelectField } from '../components/select-field.js';
import { PasswordField } from '../components/password-field.js';
import { PRESET_PROMPTS } from '../../shared/prompts.js';
import { i18n } from '../../shared/i18n.js';

/**
 * Text Rewrite settings section
 */
export class RewriteSection {
    constructor() {
        // Provider selection dropdown
        this.rewriteProviderField = new SelectField('rewrite-provider', i18n.t('rewrite.model'), [
            { value: 'groq', label: 'Groq GPT-OSS-120B' },
            { value: 'fireworks', label: 'Fireworks GPT-OSS-20B' },
            { value: 'sambanova', label: 'SambaNova Llama-3.3-70B' },
            { value: 'gemini', label: 'Gemini 2.5 Flash Lite' },
            { value: 'mistral', label: 'Mistral Small' }
        ]);

        const placeholder = i18n.t('rewrite.apiKeys.placeholder');
        const apiKeyLabel = i18n.t('apiKey.label');
        this.apiKeyFields = {
            groq: new PasswordField('rewriteGroqApiKey', `Groq ${apiKeyLabel}`, placeholder),
            fireworks: new PasswordField('rewriteFireworksApiKey', `Fireworks ${apiKeyLabel}`, placeholder),
            sambanova: new PasswordField('rewriteSambanovaApiKey', `SambaNova ${apiKeyLabel}`, placeholder),
            gemini: new PasswordField('rewriteGeminiApiKey', `Gemini ${apiKeyLabel}`, placeholder),
            mistral: new PasswordField('rewriteMistralApiKey', `Mistral ${apiKeyLabel}`, placeholder)
        };

        // Rewrite mode dropdown
        this.rewriteModeField = new SelectField('rewrite-mode', i18n.t('rewrite.mode'), [
            { value: 'grammar_correction', label: i18n.t('rewrite.modes.grammar_correction') },
            { value: 'structured', label: i18n.t('rewrite.modes.structured') },
            { value: 'professional', label: i18n.t('rewrite.modes.professional') },
            { value: 'polite', label: i18n.t('rewrite.modes.polite') },
            { value: 'casual', label: i18n.t('rewrite.modes.casual') },
            { value: 'custom', label: i18n.t('rewrite.modes.custom') }
        ]);
    }

    render() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'rewrite-section';
        
        const title = document.createElement('h2');
        title.textContent = i18n.t('rewrite.title');
        title.className = 'section-title';
        section.appendChild(title);
        
        section.appendChild(this.rewriteProviderField.render());
        
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            const fieldEl = field.render();
            fieldEl.style.display = 'none';
            fieldEl.dataset.provider = provider;
            fieldEl.classList.add('rewrite-api-key');
            section.appendChild(fieldEl);
        });

        const modeFieldEl = this.rewriteModeField.render();
        modeFieldEl.style.display = 'flex';
        modeFieldEl.style.flexDirection = 'column';
        section.appendChild(modeFieldEl);

        // Create wrapper for gradient border animation
        const textareaWrapper = document.createElement('div');
        textareaWrapper.className = 'focus-gradient-border';

        this.promptTextarea = document.createElement('textarea');
        this.promptTextarea.className = 'prompt-textarea';
        this.promptTextarea.placeholder = i18n.t('rewrite.promptPlaceholder');
        
        textareaWrapper.appendChild(this.promptTextarea);
        modeFieldEl.appendChild(textareaWrapper);
        
        return section;
    }

    initialize() {
        this.rewriteProviderField.onChange((value) => {
            this.updateApiKeyVisibility(value);
        });

        this.rewriteModeField.onChange((value) => {
            this.handleModeChange(value);
        });

        if (this.promptTextarea) {
            this.promptTextarea.addEventListener('input', () => {
                const currentMode = this.rewriteModeField.getValue();
                
                if (currentMode !== 'custom') {
                    const presetText = PRESET_PROMPTS[currentMode];
                    
                    if (this.promptTextarea.value !== presetText) {
                        this.rewriteModeField.setValue('custom');
                    }
                }
            });
        }
    }

    handleModeChange(mode) {
        if (mode === 'custom') {
            if (!this.promptTextarea.value.trim()) {
                // Keep empty
            }
        } else {
            const presetText = PRESET_PROMPTS[mode];
            if (presetText) {
                this.promptTextarea.value = presetText;
            }
        }
    }

    updateApiKeyVisibility(provider) {
        document.querySelectorAll('.rewrite-api-key').forEach(el => {
            el.style.display = 'none';
        });
        
        const relevantField = this.apiKeyFields[provider];
        if (relevantField) {
            const fieldEl = document.querySelector(`#${relevantField.id}-group.rewrite-api-key`);
            if (fieldEl) {
                fieldEl.style.display = 'block';
            }
        }
    }

    loadValues(settings) {
        this.customRewritePrompt = settings.customRewritePrompt || '';

        if (settings.rewriteProvider) {
            this.rewriteProviderField.setValue(settings.rewriteProvider);
            this.updateApiKeyVisibility(settings.rewriteProvider);
        }

        if (settings.rewriteMode) {
            this.rewriteModeField.setValue(settings.rewriteMode);
            
            if (settings.rewriteMode === 'custom') {
                this.promptTextarea.value = this.customRewritePrompt;
            } else {
                this.promptTextarea.value = PRESET_PROMPTS[settings.rewriteMode] || '';
            }
        }
        
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            const key = provider + 'ApiKey';
            if (settings[key]) {
                field.setValue(settings[key]);
            }
        });
    }

    getValues() {
        const values = {
            rewriteMode: this.rewriteModeField.getValue(),
            rewriteProvider: this.rewriteProviderField.getValue(),
            customRewritePrompt: this.promptTextarea.value
        };
        
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            values[provider + 'ApiKey'] = field.getValue();
        });
        
        return values;
    }
}
