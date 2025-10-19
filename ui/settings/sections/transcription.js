import { SelectField } from '../components/select-field.js';
import { PasswordField } from '../components/password-field.js';

/**
 * Transcription settings section
 */
export class TranscriptionSection {
    constructor() {
        this.languageField = new SelectField('language-select', 'Transcription Language', [
            { value: 'multilingual', label: 'Multilingual' },
            { value: 'en', label: 'English' },
            { value: 'it', label: 'Italian' },
            { value: 'es', label: 'Spanish' },
            { value: 'fr', label: 'French' },
            { value: 'de', label: 'German' },
            { value: 'pt', label: 'Portuguese' },
            { value: 'ja', label: 'Japanese' },
            { value: 'nl', label: 'Dutch' }
        ]);

        this.providerField = new SelectField('api-service', 'Transcription Model', [
            { value: 'deepgram', label: 'Deepgram Nova 3 (Real-time)' },
            { value: 'cartesia', label: 'Cartesia Ink Whisper (Real-time)' },
            { value: 'groq', label: 'Groq Whisper' },
            { value: 'sambanova', label: 'SambaNova Whisper' },
            { value: 'fireworks', label: 'Fireworks Whisper' },
            { value: 'gemini', label: 'Gemini 2.5 Flash Lite' },
            { value: 'mistral', label: 'Mistral Voxtral' }
        ]);

        // API key fields for each provider
        this.apiKeyFields = {
            groq: new PasswordField('groqApiKey', 'Groq API Key', 'Enter your Groq API key'),
            deepgram: new PasswordField('deepgramApiKey', 'Deepgram API Key', 'Enter your Deepgram API key'),
            cartesia: new PasswordField('cartesiaApiKey', 'Cartesia API Key', 'Enter your Cartesia API key'),
            gemini: new PasswordField('geminiApiKey', 'Gemini API Key', 'Enter your Gemini API key'),
            mistral: new PasswordField('mistralApiKey', 'Mistral API Key', 'Enter your Mistral API key'),
            sambanova: new PasswordField('sambanovaApiKey', 'SambaNova API Key', 'Enter your SambaNova API key'),
            fireworks: new PasswordField('fireworksApiKey', 'Fireworks API Key', 'Enter your Fireworks API key')
        };
    }

    render() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'transcription-section';
        
        const title = document.createElement('h2');
        title.textContent = 'Transcription';
        title.className = 'section-title';
        section.appendChild(title);
        
        const description = document.createElement('p');
        // description.textContent = 'Configure transcription model and language settings.';
        // description.className = 'section-description';
        // section.appendChild(description);
        
        section.appendChild(this.languageField.render());

        section.appendChild(this.providerField.render());
        
        // Add all API key fields (initially hidden)
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            const fieldEl = field.render();
            fieldEl.style.display = 'none';
            fieldEl.dataset.provider = provider;
            section.appendChild(fieldEl);
        });
        
        return section;
    }

    initialize() {
        // Set up change listener after DOM insertion
        this.providerField.onChange((value) => {
            this.updateApiKeyVisibility(value);
        });
    }

    updateApiKeyVisibility(provider) {
        // Hide all API key fields
        Object.entries(this.apiKeyFields).forEach(([p, field]) => {
            const fieldEl = document.querySelector(`#${field.id}-group`);
            if (fieldEl) {
                fieldEl.style.display = 'none';
            }
        });
        
        // Show the relevant API key field
        const relevantField = this.apiKeyFields[provider];
        if (relevantField) {
            const fieldEl = document.querySelector(`#${relevantField.id}-group`);
            if (fieldEl) {
                fieldEl.style.display = 'block';
            }
        }
    }

    loadValues(settings) {
        console.log('[Transcription] Loading values:', {
            provider: settings.provider,
            language: settings.language,
            apiKeys: Object.keys(this.apiKeyFields).map(p => ({ provider: p, hasKey: !!settings[p + 'ApiKey'] }))
        });
        
        if (settings.provider) {
            this.providerField.setValue(settings.provider);
            this.updateApiKeyVisibility(settings.provider);
        }
        if (settings.language) {
            this.languageField.setValue(settings.language);
        }
        
        // Load all API keys
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            const key = provider + 'ApiKey';
            if (settings[key]) {
                field.setValue(settings[key]);
            }
        });
    }

    getValues() {
        const values = {
            provider: this.providerField.getValue(),
            language: this.languageField.getValue()
        };
        
        // Get all API key values
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            values[provider + 'ApiKey'] = field.getValue();
        });
        
        console.log('[Transcription] getValues:', {
            provider: values.provider,
            language: values.language,
            apiKeys: Object.keys(this.apiKeyFields).map(p => ({ provider: p, hasKey: !!values[p + 'ApiKey'], length: values[p + 'ApiKey']?.length }))
        });
        
        return values;
    }
}
