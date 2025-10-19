import { SelectField } from '../components/select-field.js';
import { PasswordField } from '../components/password-field.js';

/**
 * Grammar Correction settings section
 */
export class GrammarSection {
    constructor() {
        this.grammarProviderField = new SelectField('grammar-provider', 'Grammar Correction Model', [
            { value: 'groq', label: 'Groq GPT-OSS-120B' },
            { value: 'fireworks', label: 'Fireworks GPT-OSS-20B' },
            { value: 'sambanova', label: 'SambaNova Llama-3.3-70B' },
            { value: 'gemini', label: 'Gemini 2.5 Flash Lite' },
            { value: 'mistral', label: 'Mistral Small' }
        ]);

        // API key fields for grammar providers (use unique IDs to avoid conflicts)
        this.apiKeyFields = {
            groq: new PasswordField('grammarGroqApiKey', 'Groq API Key', 'Enter your Groq API key'),
            fireworks: new PasswordField('grammarFireworksApiKey', 'Fireworks API Key', 'Enter your Fireworks API key'),
            sambanova: new PasswordField('grammarSambanovaApiKey', 'SambaNova API Key', 'Enter your SambaNova API key'),
            gemini: new PasswordField('grammarGeminiApiKey', 'Gemini API Key', 'Enter your Gemini API key'),
            mistral: new PasswordField('grammarMistralApiKey', 'Mistral API Key', 'Enter your Mistral API key')
        };
    }

    render() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'grammar-section';
        
        const title = document.createElement('h2');
        title.textContent = 'Grammar Correction';
        title.className = 'section-title';
        section.appendChild(title);
        
        const description = document.createElement('p');
        // description.textContent = 'Configure grammar correction model and API key.';
        // description.className = 'section-description';
        // section.appendChild(description);
        
        section.appendChild(this.grammarProviderField.render());
        
        // Add all API key fields (initially hidden)
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            const fieldEl = field.render();
            fieldEl.style.display = 'none';
            fieldEl.dataset.provider = provider;
            fieldEl.classList.add('grammar-api-key');
            section.appendChild(fieldEl);
        });
        
        return section;
    }

    initialize() {
        // Set up change listener after DOM insertion
        this.grammarProviderField.onChange((value) => {
            this.updateApiKeyVisibility(value);
        });
    }

    updateApiKeyVisibility(provider) {
        // Hide all API key fields for grammar
        document.querySelectorAll('.grammar-api-key').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show the relevant API key field
        const relevantField = this.apiKeyFields[provider];
        if (relevantField) {
            const fieldEl = document.querySelector(`#${relevantField.id}-group.grammar-api-key`);
            if (fieldEl) {
                fieldEl.style.display = 'block';
            }
        }
    }

    loadValues(settings) {
        console.log('[Grammar] Loading values:', {
            grammarProvider: settings.grammarProvider,
            apiKeys: Object.keys(this.apiKeyFields).map(p => ({ provider: p, hasKey: !!settings[p + 'ApiKey'] }))
        });
        
        if (settings.grammarProvider) {
            this.grammarProviderField.setValue(settings.grammarProvider);
            this.updateApiKeyVisibility(settings.grammarProvider);
        }
        
        // Load all API keys from backend (same keys as transcription section)
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            const key = provider + 'ApiKey';
            if (settings[key]) {
                field.setValue(settings[key]);
                console.log(`[Grammar] Set ${provider} API key`);
            }
        });
    }

    getValues() {
        const values = {
            grammarProvider: this.grammarProviderField.getValue()
        };
        
        // Get all API key values
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            values[provider + 'ApiKey'] = field.getValue();
        });
        
        console.log('[Grammar] getValues:', {
            grammarProvider: values.grammarProvider,
            apiKeys: Object.keys(this.apiKeyFields).map(p => ({ provider: p, hasKey: !!values[p + 'ApiKey'], length: values[p + 'ApiKey']?.length }))
        });
        
        return values;
    }
}
