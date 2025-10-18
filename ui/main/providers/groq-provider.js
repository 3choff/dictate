/**
 * Groq Provider
 * Batch transcription using Groq's Whisper API
 */

import { BatchProvider } from './batch-provider.js';

export class GroqProvider extends BatchProvider {
    getName() {
        return 'groq';
    }

    async transcribeSegment(wavBytes) {
        await this.invoke('transcribe_audio_segment', {
            audioData: Array.from(wavBytes),
            apiKey: this.apiKey,
            apiService: 'groq',
            language: this.language,
            textFormatted: this.smartFormat,
            insertionMode: this.insertionMode,
            voiceCommandsEnabled: this.voiceCommandsEnabled
        });
    }
}
