/**
 * CrisperWhisper Provider
 * Batch transcription using Nyra CrisperWhisper API
 */

import { BatchProvider } from './batch-provider.js';

export class CrisperWhisperProvider extends BatchProvider {
    getName() {
        return 'crisperwhisper';
    }

    async transcribeSegment(wavBytes) {
        await this.invoke('transcribe_audio_segment', {
            audioData: Array.from(wavBytes),
            apiKey: this.apiKey,
            apiService: 'crisperwhisper',
            language: this.language,
            textFormatted: this.smartFormat,
            insertionMode: this.insertionMode,
            voiceCommandsEnabled: this.voiceCommandsEnabled
        });
    }
}
