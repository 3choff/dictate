import { SelectField } from '../components/select-field.js';
import { PasswordField } from '../components/password-field.js';
import { PRESET_PROMPTS } from '../../shared/prompts.js';

/**
 * Text Rewrite settings section
 */
export class RewriteSection {
    constructor() {
        // Provider selection dropdown
        this.rewriteProviderField = new SelectField('rewrite-provider', 'Model', [
            { value: 'groq', label: 'Groq GPT-OSS-120B' },
            { value: 'fireworks', label: 'Fireworks GPT-OSS-20B' },
            { value: 'sambanova', label: 'SambaNova Llama-3.3-70B' },
            { value: 'gemini', label: 'Gemini 2.5 Flash Lite' },
            { value: 'mistral', label: 'Mistral Small' }
        ]);

        // API key fields for rewrite providers (use unique IDs to avoid conflicts)
        this.apiKeyFields = {
            groq: new PasswordField('rewriteGroqApiKey', 'Groq API Key', 'Enter your Groq API key'),
            fireworks: new PasswordField('rewriteFireworksApiKey', 'Fireworks API Key', 'Enter your Fireworks API key'),
            sambanova: new PasswordField('rewriteSambanovaApiKey', 'SambaNova API Key', 'Enter your SambaNova API key'),
            gemini: new PasswordField('rewriteGeminiApiKey', 'Gemini API Key', 'Enter your Gemini API key'),
            mistral: new PasswordField('rewriteMistralApiKey', 'Mistral API Key', 'Enter your Mistral API key')
        };

        // Rewrite mode dropdown
        this.rewriteModeField = new SelectField('rewrite-mode', 'Mode', [
            { value: 'grammar_correction', label: 'Grammar Correction' },
            { value: 'structured', label: 'Structured' },
            { value: 'professional', label: 'Professional' },
            { value: 'polite', label: 'Polite' },
            { value: 'casual', label: 'Casual' },
            { value: 'custom', label: 'Custom' }
        ]);
    }

    render() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'rewrite-section';
        
        const title = document.createElement('h2');
        title.textContent = 'Rewrite';
        title.className = 'section-title';
        section.appendChild(title);
        
        // Add provider dropdown
        section.appendChild(this.rewriteProviderField.render());
        
        // Add all API key fields (initially hidden)
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            const fieldEl = field.render();
            fieldEl.style.display = 'none';
            fieldEl.dataset.provider = provider;
            fieldEl.classList.add('rewrite-api-key');
            section.appendChild(fieldEl);
        });

        // Add rewrite mode dropdown
        const modeFieldEl = this.rewriteModeField.render();
        modeFieldEl.style.display = 'flex';
        modeFieldEl.style.flexDirection = 'column';
        section.appendChild(modeFieldEl);

        // Prompt edit area
        this.promptTextarea = document.createElement('textarea');
        this.promptTextarea.className = 'prompt-textarea';
        this.promptTextarea.placeholder = 'Enter explanation of how to rewrite the text...';
        
        // Append textarea inside the mode field container
        modeFieldEl.appendChild(this.promptTextarea);
        
        return section;
    }

    initialize() {
        // Set up change listener after DOM insertion
        this.rewriteProviderField.onChange((value) => {
            this.updateApiKeyVisibility(value);
        });

        this.rewriteModeField.onChange((value) => {
            this.handleModeChange(value);
        });

        // Add input listener to textarea
        if (this.promptTextarea) {
            this.promptTextarea.addEventListener('input', () => {
                // If user edits text and we're not in custom mode, switch to custom
                const currentMode = this.rewriteModeField.getValue();
                
                if (currentMode !== 'custom') {
                    // Check if text actually differs from preset
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
            // If switching to custom manually, keep current text or load default if empty
            if (!this.promptTextarea.value.trim()) {
                // this.promptTextarea.value = ''; // Keep empty or set default?
            }
        } else {
            // Switch to preset text
            const presetText = PRESET_PROMPTS[mode];
            if (presetText) {
                this.promptTextarea.value = presetText;
            }
        }
    }

    updateApiKeyVisibility(provider) {
        // Hide all API key fields for rewrite
        document.querySelectorAll('.rewrite-api-key').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show the relevant API key field
        const relevantField = this.apiKeyFields[provider];
        if (relevantField) {
            const fieldEl = document.querySelector(`#${relevantField.id}-group.rewrite-api-key`);
            if (fieldEl) {
                fieldEl.style.display = 'block';
            }
        }
    }

    loadValues(settings) {
        console.log('[Rewrite] Loading values:', {
            rewriteMode: settings.rewriteMode,
            rewriteProvider: settings.rewriteProvider,
            customRewritePrompt: settings.customRewritePrompt,
            apiKeys: Object.keys(this.apiKeyFields).map(p => ({ provider: p, hasKey: !!settings[p + 'ApiKey'] }))
        });
        
        // Load settings to internal state
        this.customRewritePrompt = settings.customRewritePrompt || '';

        // Load provider selection
        if (settings.rewriteProvider) {
            this.rewriteProviderField.setValue(settings.rewriteProvider);
            this.updateApiKeyVisibility(settings.rewriteProvider);
        }

        // Load mode and prompt text
        if (settings.rewriteMode) {
            this.rewriteModeField.setValue(settings.rewriteMode);
            
            if (settings.rewriteMode === 'custom') {
                this.promptTextarea.value = this.customRewritePrompt;
            } else {
                this.promptTextarea.value = PRESET_PROMPTS[settings.rewriteMode] || '';
            }
        }
        
        // Load all API keys from backend
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
        
        // Get all API key values
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            values[provider + 'ApiKey'] = field.getValue();
        });
        
        console.log('[Rewrite] getValues:', {
            rewriteMode: values.rewriteMode,
            rewriteProvider: values.rewriteProvider,
            customRewritePrompt: values.customRewritePrompt,
            apiKeys: Object.keys(this.apiKeyFields).map(p => ({ provider: p, hasKey: !!values[p + 'ApiKey'], length: values[p + 'ApiKey']?.length }))
        });
        
        return values;
    }
}
