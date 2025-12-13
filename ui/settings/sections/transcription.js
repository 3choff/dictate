import { SelectField } from '../components/select-field.js';
import { PasswordField } from '../components/password-field.js';
import { SliderField } from '../components/slider-field.js';
import { CustomWordsList } from '../components/custom-words-list.js';
import { ToggleSwitch } from '../components/toggle-switch.js';
import { i18n } from '../../shared/i18n.js';

/**
 * Transcription settings section
 */
export class TranscriptionSection {
    constructor() {
        this.languageField = new SelectField('language-select', i18n.t('transcription.language'), [
            { value: 'multilingual', label: i18n.t('transcription.languages.multilingual') },
            { value: 'en', label: i18n.t('transcription.languages.en') },
            { value: 'it', label: i18n.t('transcription.languages.it') },
            { value: 'es', label: i18n.t('transcription.languages.es') },
            { value: 'fr', label: i18n.t('transcription.languages.fr') },
            { value: 'de', label: i18n.t('transcription.languages.de') },
            { value: 'pt', label: i18n.t('transcription.languages.pt') },
            { value: 'ja', label: i18n.t('transcription.languages.ja') },
            { value: 'nl', label: i18n.t('transcription.languages.nl') },
            { value: 'zh', label: i18n.t('transcription.languages.zh') },
            { value: 'ru', label: i18n.t('transcription.languages.ru') }
        ]);

        this.providerField = new SelectField('api-service', i18n.t('transcription.model'), [
            { value: 'deepgram', label: 'Deepgram Nova 3 (Real-time)' },
            { value: 'cartesia', label: 'Cartesia Ink Whisper (Real-time)' },
            { value: 'groq', label: 'Groq Whisper' },
            { value: 'sambanova', label: 'SambaNova Whisper' },
            { value: 'fireworks', label: 'Fireworks Whisper' },
            { value: 'gemini', label: 'Gemini 2.5 Flash Lite' },
            { value: 'mistral', label: 'Mistral Voxtral' }
        ]);

        // API key fields
        const placeholder = i18n.t('transcription.apiKeys.placeholder');
        const apiKeyLabel = i18n.t('apiKey.label');
        this.apiKeyFields = {
            groq: new PasswordField('groqApiKey', `Groq ${apiKeyLabel}`, placeholder),
            deepgram: new PasswordField('deepgramApiKey', `Deepgram ${apiKeyLabel}`, placeholder),
            cartesia: new PasswordField('cartesiaApiKey', `Cartesia ${apiKeyLabel}`, placeholder),
            gemini: new PasswordField('geminiApiKey', `Gemini ${apiKeyLabel}`, placeholder),
            mistral: new PasswordField('mistralApiKey', `Mistral ${apiKeyLabel}`, placeholder),
            sambanova: new PasswordField('sambanovaApiKey', `SambaNova ${apiKeyLabel}`, placeholder),
            fireworks: new PasswordField('fireworksApiKey', `Fireworks ${apiKeyLabel}`, placeholder)
        };

        // Word correction components
        this.wordCorrectionToggle = new ToggleSwitch('word-correction-enabled', '');
        
        this.wordCorrectionThreshold = new SliderField(
            'word-correction-threshold',
            i18n.t('transcription.threshold'),
            0.05, // min
            0.50, // max
            0.01, // step
            0.18, // default
            'transcription.tooltips.threshold' // tooltip key
        );

        this.customWordsList = new CustomWordsList('custom-words', i18n.t('transcription.customWords'));
    }

    render() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'transcription-section';
        
        const title = document.createElement('h2');
        title.textContent = i18n.t('transcription.title');
        title.className = 'section-title';
        section.appendChild(title);
        
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

        // Header with label and toggle
        const groupHeader = document.createElement('div');
        groupHeader.className = 'settings-group-header';
        groupHeader.style.display = 'flex';
        groupHeader.style.justifyContent = 'space-between';
        groupHeader.style.alignItems = 'center';
        groupHeader.style.marginBottom = '6px';

        const wordCorrectionLabel = document.createElement('div');
        wordCorrectionLabel.className = 'settings-group-label';
        wordCorrectionLabel.textContent = i18n.t('transcription.wordCorrection');
        wordCorrectionLabel.style.marginBottom = '0';
        
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
        Object.entries(this.apiKeyFields).forEach(([p, field]) => {
            const fieldEl = document.querySelector(`#${field.id}-group`);
            if (fieldEl) {
                fieldEl.style.display = 'none';
            }
        });
        
        const relevantField = this.apiKeyFields[provider];
        if (relevantField) {
            const fieldEl = document.querySelector(`#${relevantField.id}-group`);
            if (fieldEl) {
                fieldEl.style.display = 'block';
            }
        }
    }

    loadValues(settings) {
        if (settings.provider) {
            this.providerField.setValue(settings.provider);
            this.updateApiKeyVisibility(settings.provider);
        }
        if (settings.language) {
            this.languageField.setValue(settings.language);
        }
        
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            const key = provider + 'ApiKey';
            if (settings[key]) {
                field.setValue(settings[key]);
            }
        });

        if (settings.wordCorrectionThreshold !== undefined) {
            this.wordCorrectionThreshold.setValue(settings.wordCorrectionThreshold);
        }
        if (settings.customWords) {
            this.customWordsList.setValue(settings.customWords);
        }
        if (settings.wordCorrectionEnabled !== undefined) {
            this.wordCorrectionToggle.setValue(settings.wordCorrectionEnabled);
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
        
        Object.entries(this.apiKeyFields).forEach(([provider, field]) => {
            values[provider + 'ApiKey'] = field.getValue();
        });
        
        return values;
    }
}
