/**
 * Gemini 3.5 Transcribe Provider
 * Batch transcription using specialized Gemini 3.5 Transcribe model
 */

import { BatchProvider } from './batch-provider.js';

export class GeminiTranscribeProvider extends BatchProvider {
    constructor(config) {
        super(config);
        this.smartTranscription = config.smartTranscription !== undefined ? config.smartTranscription : true;
    }

    getName() {
        return 'gemini-transcribe';
    }

    async transcribeSegment(wavBytes) {
        await this.invoke('transcribe_audio_segment', {
            audioData: Array.from(wavBytes),
            apiKey: this.apiKey,
            apiService: 'gemini-transcribe',
            language: this.language,
            textFormatted: this.smartFormat,
            smartTranscription: this.smartTranscription,
            insertionMode: this.insertionMode,
            voiceCommandsEnabled: this.voiceCommandsEnabled
        });
    }
}
