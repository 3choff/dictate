/**
 * Fireworks Provider
 * Batch transcription using Fireworks AI API
 */

import { BatchProvider } from './batch-provider.js';

export class FireworksProvider extends BatchProvider {
    getName() {
        return 'fireworks';
    }

    async transcribeSegment(wavBytes) {
        await this.invoke('transcribe_audio_segment', {
            audioData: Array.from(wavBytes),
            apiKey: this.apiKey,
            apiService: 'fireworks',
            language: this.language,
            textFormatted: this.smartFormat,
            insertionMode: this.insertionMode,
            voiceCommandsEnabled: this.voiceCommandsEnabled
        });
    }
}
