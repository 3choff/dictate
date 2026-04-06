/**
 * Voxtral Provider
 * Streaming transcription using Mistral's Voxtral Realtime WebSocket API
 */

import { BaseProvider } from './base-provider.js';

export class VoxtralProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.audioHelpers = config.audioHelpers;
    }

    getType() {
        return 'streaming';
    }

    getName() {
        return 'voxtral';
    }

    async start(audioCaptureManager, visualizer) {
        this.isActive = true;

        // Language is always auto-detected by Voxtral - pass 'multi' as placeholder
        let streamLanguage = 'multi';
        
        // Start backend streaming session
        this.sessionId = await this.invoke('start_streaming_transcription', {
            provider: 'voxtral',
            apiKey: this.apiKey,
            language: streamLanguage,
            smartFormat: this.smartFormat,
            insertionMode: this.insertionMode,
            encoding: 'linear16',
            voiceCommandsEnabled: this.voiceCommandsEnabled
        });
        
        // Start audio capture with PCM16 callback
        const audioContext = await audioCaptureManager.start(async (audioData, sampleRate) => {
            if (!this.sessionId) return;
            
            const mono = audioData; // Already mono from worklet
            
            // Downsample to 16kHz PCM16
            const int16 = this.audioHelpers.downsampleTo16kInt16(mono, sampleRate);
            
            // Send PCM16 data to Voxtral via backend
            try {
                const audioData = Array.from(new Uint8Array(int16.buffer));
                await this.invoke('send_streaming_audio', {
                    sessionId: this.sessionId,
                    audioData: audioData
                });
            } catch (error) {
                console.error('[Voxtral] Failed to send audio:', error);
            }
        });
        
        // Setup visualizer
        visualizer.connect(audioContext, audioCaptureManager.getSourceNode());
        visualizer.start();
    }

    async stop() {
        // Close backend streaming session
        if (this.sessionId) {
            try {
                await this.invoke('stop_streaming_transcription', {
                    sessionId: this.sessionId
                });
            } catch (error) {
                console.error('[Voxtral] Failed to stop session:', error);
            }
            this.sessionId = null;
        }
        
        this.isActive = false;
    }
}
