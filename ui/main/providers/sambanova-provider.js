/**
 * SambaNova Provider
 * Batch transcription using SambaNova API
 */

import { BatchProvider } from './batch-provider.js';

export class SambaNovaProvider extends BatchProvider {
    getName() {
        return 'sambanova';
    }

    async transcribeSegment(wavBytes) {
        await this.invoke('transcribe_audio_segment', {
            audioData: Array.from(wavBytes),
            apiKey: this.apiKey,
            apiService: 'sambanova',
            language: this.language,
            textFormatted: this.smartFormat,
            insertionMode: this.insertionMode,
            voiceCommandsEnabled: this.voiceCommandsEnabled
        });
    }
}
