import { SelectField } from '../components/select-field.js';
import { PasswordField } from '../components/password-field.js';
import { ToggleSwitch } from '../components/toggle-switch.js';
import { TtsPlayer } from '../../shared/tts-player.js';
import { i18n } from '../../shared/i18n.js';

const { invoke } = window.__TAURI__?.core || {};

/**
 * Text to Speech settings section
 * Providers: 60dB TTS (default) and ElevenLabs TTS
 */
export class TtsSection {
    constructor() {
        this.providerField = new SelectField('tts-provider', i18n.t('tts.provider'), [
            { value: '60db', label: '60dB TTS' },
            { value: 'elevenlabs', label: 'ElevenLabs TTS' }
        ]);

        // 60dB voice tier (used when fetching the voice list)
        this.voiceModelField = new SelectField('tts-voice-model', i18n.t('tts.voiceModel'), [
            { value: 'quality', label: '60dB Quality' },
            { value: 'fast', label: '60dB Fast' }
        ]);

        // API key fields
        const placeholder = i18n.t('transcription.apiKeys.placeholder');
        const apiKeyLabel = i18n.t('apiKey.label');
        this.sixtydbApiKeyField = new PasswordField('ttsSixtydbApiKey', `60dB ${apiKeyLabel}`, placeholder);
        this.elevenlabsApiKeyField = new PasswordField('ttsElevenlabsApiKey', `ElevenLabs ${apiKeyLabel}`, placeholder);

        // Read-back toggle
        this.readbackToggle = new ToggleSwitch('tts-readback-enabled', i18n.t('tts.readback'));

        // Voice picker state
        this.currentVoiceId = '';
        this.isFetchingVoices = false;

        // Preview playback (settings window)
        this.ttsPlayer = new TtsPlayer(invoke);
    }

    render() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = 'tts-section';

        const title = document.createElement('h2');
        title.textContent = i18n.t('tts.title');
        title.className = 'section-title';
        section.appendChild(title);

        section.appendChild(this.providerField.render());

        // API key fields (visibility follows provider selection)
        const sixtydbFieldEl = this.sixtydbApiKeyField.render();
        sixtydbFieldEl.dataset.ttsProvider = '60db';
        section.appendChild(sixtydbFieldEl);

        const elevenlabsFieldEl = this.elevenlabsApiKeyField.render();
        elevenlabsFieldEl.dataset.ttsProvider = 'elevenlabs';
        section.appendChild(elevenlabsFieldEl);

        // 60dB voice tier (only shown for 60dB provider)
        const voiceModelEl = this.voiceModelField.render();
        voiceModelEl.dataset.ttsProvider = '60db';
        section.appendChild(voiceModelEl);

        // Voice picker with fetch + preview actions
        const voiceGroup = document.createElement('div');
        voiceGroup.className = 'form-group';

        const voiceLabel = document.createElement('label');
        voiceLabel.htmlFor = 'tts-voice';
        voiceLabel.textContent = i18n.t('tts.voice');
        voiceGroup.appendChild(voiceLabel);

        const voiceRow = document.createElement('div');
        voiceRow.className = 'tts-voice-row';

        const voiceBorder = document.createElement('div');
        voiceBorder.className = 'focus-gradient-border';

        const voiceSelect = document.createElement('select');
        voiceSelect.id = 'tts-voice';
        voiceSelect.className = 'custom-select';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = i18n.t('tts.defaultVoice');
        voiceSelect.appendChild(defaultOption);
        voiceBorder.appendChild(voiceSelect);
        voiceRow.appendChild(voiceBorder);

        const fetchBtn = document.createElement('button');
        fetchBtn.type = 'button';
        fetchBtn.id = 'tts-fetch-voices';
        fetchBtn.className = 'tts-button';
        fetchBtn.textContent = i18n.t('tts.fetchVoices');
        voiceRow.appendChild(fetchBtn);

        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.id = 'tts-preview-voice';
        previewBtn.className = 'tts-button';
        previewBtn.textContent = i18n.t('tts.preview');
        voiceRow.appendChild(previewBtn);

        voiceGroup.appendChild(voiceRow);
        section.appendChild(voiceGroup);

        // Read-back toggle
        section.appendChild(this.readbackToggle.render());

        return section;
    }

    initialize() {
        // Provider switch shows/hides provider-specific fields
        this.providerField.onChange((value) => {
            this.updateProviderVisibility(value);
        });
        this.updateProviderVisibility(this.providerField.getValue() || '60db');

        // Re-fetch voices when the 60dB tier changes
        this.voiceModelField.onChange(() => {
            if (this.hasVoicesLoaded()) this.fetchVoices();
        });

        document.getElementById('tts-fetch-voices')?.addEventListener('click', () => {
            this.fetchVoices();
        });

        document.getElementById('tts-preview-voice')?.addEventListener('click', () => {
            this.previewVoice();
        });
    }

    updateProviderVisibility(provider) {
        document.querySelectorAll('#tts-section [data-tts-provider]').forEach((el) => {
            el.style.display = el.dataset.ttsProvider === provider ? '' : 'none';
        });
    }

    hasVoicesLoaded() {
        const select = document.getElementById('tts-voice');
        return Boolean(select && select.options.length > 1);
    }

    async fetchVoices() {
        if (this.isFetchingVoices) return;
        this.isFetchingVoices = true;

        const fetchBtn = document.getElementById('tts-fetch-voices');
        const originalText = fetchBtn?.textContent;
        if (fetchBtn) {
            fetchBtn.disabled = true;
            fetchBtn.textContent = '...';
        }

        try {
            const provider = this.providerField.getValue() || '60db';
            const apiKey = provider === 'elevenlabs'
                ? this.elevenlabsApiKeyField.getValue()
                : this.sixtydbApiKeyField.getValue();
            const model = this.voiceModelField.getValue() || 'quality';

            // Pass the unsaved key so voices can be listed before saving
            const voices = await invoke('tts_get_voices', {
                provider,
                apiKey: apiKey || null,
                model
            });
            this.populateVoices(voices || []);
        } catch (error) {
            console.error('[TTS] Failed to fetch voices:', error);
        } finally {
            this.isFetchingVoices = false;
            if (fetchBtn) {
                fetchBtn.disabled = false;
                fetchBtn.textContent = originalText || i18n.t('tts.fetchVoices');
            }
        }
    }

    populateVoices(voices) {
        const select = document.getElementById('tts-voice');
        if (!select) return;

        select.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = i18n.t('tts.defaultVoice');
        select.appendChild(defaultOption);

        voices.forEach((voice) => {
            const option = document.createElement('option');
            option.value = voice.voice_id;
            const meta = [voice.language, voice.gender].filter(Boolean).join(', ');
            option.textContent = meta ? `${voice.name} (${meta})` : voice.name;
            select.appendChild(option);
        });

        // Restore current selection when present in the list
        if (this.currentVoiceId) select.value = this.currentVoiceId;

        // Rebuild the custom dropdown for the new options
        window.__refreshCustomSelect?.(select);
    }

    async previewVoice() {
        const previewBtn = document.getElementById('tts-preview-voice');
        if (previewBtn) previewBtn.disabled = true;

        try {
            // Flush pending saves so the preview uses the fields' current values
            if (window.__saveSettingsNow) {
                await window.__saveSettingsNow();
            }

            this.ttsPlayer.stop();
            await this.ttsPlayer.speak(i18n.t('tts.previewText'));
        } catch (error) {
            console.error('[TTS] Preview failed:', error);
        } finally {
            if (previewBtn) previewBtn.disabled = false;
        }
    }

    loadValues(settings) {
        this.currentVoiceId = settings.ttsVoiceId || '';

        this.providerField.setValue(settings.ttsProvider || '60db');
        this.voiceModelField.setValue(settings.ttsModel || 'quality');
        this.sixtydbApiKeyField.setValue(settings.sixtydbApiKey || '');
        this.elevenlabsApiKeyField.setValue(settings.elevenlabsApiKey || '');
        this.readbackToggle.setValue(settings.ttsReadbackEnabled === true);

        this.updateProviderVisibility(settings.ttsProvider || '60db');
    }

    getValues() {
        return {
            ttsProvider: this.providerField.getValue() || '60db',
            ttsModel: this.voiceModelField.getValue() || 'quality',
            ttsVoiceId: document.getElementById('tts-voice')?.value || '',
            sixtydbApiKey: this.sixtydbApiKeyField.getValue(),
            elevenlabsApiKey: this.elevenlabsApiKeyField.getValue(),
            ttsReadbackEnabled: this.readbackToggle.getValue()
        };
    }
}
