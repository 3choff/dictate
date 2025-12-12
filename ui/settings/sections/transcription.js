import { SelectField } from '../components/select-field.js';
import { PasswordField } from '../components/password-field.js';
import { SliderField } from '../components/slider-field.js';
import { CustomWordsList } from '../components/custom-words-list.js';
import { ToggleSwitch } from '../components/toggle-switch.js';

/**
 * Transcription settings section
 */
export class TranscriptionSection {
    constructor() {
        this.languageField = new SelectField('language-select', 'Language', [
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

        this.providerField = new SelectField('api-service', 'Model', [
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

        // Word correction components
        this.wordCorrectionToggle = new ToggleSwitch('word-correction-enabled', '');
        
        this.wordCorrectionThreshold = new SliderField(
            'word-correction-threshold',
            'Threshold',
            0.05, // min
            0.50, // max
            0.01, // step
            0.18  // default
        );

        this.customWordsList = new CustomWordsList('custom-words', 'Custom Words');
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

        // Word Correction section
        const wordCorrectionGroup = document.createElement('div');
        wordCorrectionGroup.className = 'settings-group';
        // wordCorrectionGroup.style.marginTop = '20px';

        // Header with label and toggle
        const groupHeader = document.createElement('div');
        groupHeader.className = 'settings-group-header';
        groupHeader.style.display = 'flex';
        groupHeader.style.justifyContent = 'space-between';
        groupHeader.style.alignItems = 'center';
        groupHeader.style.marginBottom = '6px';

        const wordCorrectionLabel = document.createElement('div');
        wordCorrectionLabel.className = 'settings-group-label';
        wordCorrectionLabel.textContent = 'Word Correction';
        wordCorrectionLabel.style.marginBottom = '0'; // Override default margin
        
        groupHeader.appendChild(wordCorrectionLabel);
        groupHeader.appendChild(this.wordCorrectionToggle.render());
        
        wordCorrectionGroup.appendChild(groupHeader);

        const wordCorrectionBody = document.createElement('div');
        wordCorrectionBody.className = 'settings-group-body';
        wordCorrectionBody.id = 'word-correction-body';
        wordCorrectionBody.style.transition = 'opacity 0.2s ease, pointer-events 0.2s ease';
        
        wordCorrectionBody.appendChild(this.wordCorrectionThreshold.render());
        wordCorrectionBody.appendChild(this.customWordsList.render());
        wordCorrectionGroup.appendChild(wordCorrectionBody);

        section.appendChild(wordCorrectionGroup);
        
        return section;
    }

    initialize(generalSection) {
        // Store reference to general section for PTT warning updates
        this.generalSection = generalSection;
        
        // Set up change listener after DOM insertion
        this.providerField.onChange((value) => {
            this.updateApiKeyVisibility(value);
            // Update PTT warning when provider changes
            if (this.generalSection && this.generalSection.updatePttWarning) {
                this.generalSection.updatePttWarning();
            }
        });

        this.wordCorrectionToggle.onChange((enabled) => {
            this.updateWordCorrectionState(enabled);
        });
    }

    updateWordCorrectionState(enabled) {
        const body = document.getElementById('word-correction-body');
        if (body) {
            if (enabled) {
                body.style.opacity = '1';
                body.style.pointerEvents = 'auto';
            } else {
                body.style.opacity = '0.5';
                body.style.pointerEvents = 'none';
            }
        }
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
            customWords: settings.customWords,
            wordCorrectionThreshold: settings.wordCorrectionThreshold,
            wordCorrectionEnabled: settings.wordCorrectionEnabled,
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

        // Load word correction settings
        if (settings.wordCorrectionThreshold !== undefined) {
            this.wordCorrectionThreshold.setValue(settings.wordCorrectionThreshold);
        }
        if (settings.customWords) {
            this.customWordsList.setValue(settings.customWords);
        }
        if (settings.wordCorrectionEnabled !== undefined) {
            this.wordCorrectionToggle.setValue(settings.wordCorrectionEnabled);
            // We need to wait for DOM to be ready to update state visually
            requestAnimationFrame(() => {
                this.updateWordCorrectionState(settings.wordCorrectionEnabled);
            });
        }
    }

    getValues() {
        const values = {
            provider: this.providerField.getValue(),
            language: this.languageField.getValue(),
            wordCorrectionThreshold: this.wordCorrectionThreshold.getValue(),
            customWords: this.customWordsList.getValue(),
            wordCorrectionEnabled: this.wordCorrectionToggle.getValue()
        };
        
        // Get all API key values
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            values[provider + 'ApiKey'] = field.getValue();
        });
        
        console.log('[Transcription] getValues:', {
            provider: values.provider,
            language: values.language,
            customWords: values.customWords,
            wordCorrectionThreshold: values.wordCorrectionThreshold,
            wordCorrectionEnabled: values.wordCorrectionEnabled,
            apiKeys: Object.keys(this.apiKeyFields).map(p => ({ provider: p, hasKey: !!values[p + 'ApiKey'], length: values[p + 'ApiKey']?.length }))
        });
        
        return values;
    }
}
