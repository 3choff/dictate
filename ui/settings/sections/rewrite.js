import { SelectField } from '../components/select-field.js';
import { PasswordField } from '../components/password-field.js';

/**
 * Text Rewrite settings section
 */
export class RewriteSection {
    constructor() {
        // Rewrite mode dropdown
        this.rewriteModeField = new SelectField('rewrite-mode', 'Rewrite Mode', [
            { value: 'grammar_correction', label: 'Grammar Correction' },
            { value: 'structured', label: 'Structured' },
            { value: 'professional', label: 'Professional' },
            { value: 'polite', label: 'Polite' },
            { value: 'casual', label: 'Casual' }
            
        ]);

        // Provider selection dropdown
        this.rewriteProviderField = new SelectField('rewrite-provider', 'AI Model', [
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
    }

    render() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'rewrite-section';
        
        const title = document.createElement('h2');
        title.textContent = 'Rewrite';
        title.className = 'section-title';
        section.appendChild(title);
        
        // const description = document.createElement('p');
        // description.textContent = 'Configure text rewriting mode and AI model. Use the sparkle button or keyboard shortcut to rewrite selected text.';
        // description.className = 'section-description';
        // section.appendChild(description);
        
        // Add rewrite mode dropdown
        section.appendChild(this.rewriteModeField.render());
        
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
        
        return section;
    }

    initialize() {
        // Set up change listener after DOM insertion
        this.rewriteProviderField.onChange((value) => {
            this.updateApiKeyVisibility(value);
        });
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
            apiKeys: Object.keys(this.apiKeyFields).map(p => ({ provider: p, hasKey: !!settings[p + 'ApiKey'] }))
        });
        
        // Load rewrite mode
        if (settings.rewriteMode) {
            this.rewriteModeField.setValue(settings.rewriteMode);
        }
        
        // Load provider selection
        if (settings.rewriteProvider) {
            this.rewriteProviderField.setValue(settings.rewriteProvider);
            this.updateApiKeyVisibility(settings.rewriteProvider);
        }
        
        // Load all API keys from backend (same keys as transcription section)
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            const key = provider + 'ApiKey';
            if (settings[key]) {
                field.setValue(settings[key]);
                console.log(`[Rewrite] Set ${provider} API key`);
            }
        });
    }

    getValues() {
        const values = {
            rewriteMode: this.rewriteModeField.getValue(),
            rewriteProvider: this.rewriteProviderField.getValue()
        };
        
        // Get all API key values
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            values[provider + 'ApiKey'] = field.getValue();
        });
        
        console.log('[Rewrite] getValues:', {
            rewriteMode: values.rewriteMode,
            rewriteProvider: values.rewriteProvider,
            apiKeys: Object.keys(this.apiKeyFields).map(p => ({ provider: p, hasKey: !!values[p + 'ApiKey'], length: values[p + 'ApiKey']?.length }))
        });
        
        return values;
    }
}
