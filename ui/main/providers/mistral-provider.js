/**
 * Mistral Provider
 * Batch transcription using Mistral AI API
 */

import { BatchProvider } from './batch-provider.js';

export class MistralProvider extends BatchProvider {
    getName() {
        return 'mistral';
    }

    async transcribeSegment(wavBytes) {
        await this.invoke('transcribe_audio_segment', {
            audioData: Array.from(wavBytes),
            apiKey: this.apiKey,
            apiService: 'mistral',
            language: this.language,
            textFormatted: this.smartFormat,
            insertionMode: this.insertionMode,
            voiceCommandsEnabled: this.voiceCommandsEnabled
        });
    }
}
