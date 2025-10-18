/**
 * Gemini Provider
 * Batch transcription using Google Gemini API
 */

import { BatchProvider } from './batch-provider.js';

export class GeminiProvider extends BatchProvider {
    getName() {
        return 'gemini';
    }

    async transcribeSegment(wavBytes) {
        await this.invoke('transcribe_audio_segment', {
            audioData: Array.from(wavBytes),
            apiKey: this.apiKey,
            apiService: 'gemini',
            language: this.language,
            textFormatted: this.smartFormat,
            insertionMode: this.insertionMode,
            voiceCommandsEnabled: this.voiceCommandsEnabled
        });
    }
}
