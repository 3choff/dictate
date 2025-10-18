/**
 * Cartesia Provider
 * Streaming transcription using Cartesia's WebSocket API
 */

import { BaseProvider } from './base-provider.js';

export class CartesiaProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.audioHelpers = config.audioHelpers;
    }

    getType() {
        return 'streaming';
    }

    getName() {
        return 'cartesia';
    }

    async start(audioCaptureManager, visualizer) {
        this.isActive = true;

        // Determine language (use 'multi' for multilingual)
        let streamLanguage = (this.language === 'multilingual' || !this.language) ? 'multi' : this.language;
        
        // Start backend streaming session
        this.sessionId = await this.invoke('start_streaming_transcription', {
            provider: 'cartesia',
            apiKey: this.apiKey,
            language: streamLanguage,
            smartFormat: this.smartFormat,
            insertionMode: this.insertionMode,
            encoding: null,
            voiceCommandsEnabled: this.voiceCommandsEnabled
        });
        
        // Start audio capture with Cartesia callback
        const audioContext = await audioCaptureManager.start(async (audioData, sampleRate) => {
            if (!this.sessionId) return;
            
            const mono = audioData; // Already mono from worklet
            
            // Apply soft clipping to reduce AGC spike impact
            let maxSample = 0;
            for (let i = 0; i < mono.length; i++) {
                const abs = Math.abs(mono[i]);
                if (abs > maxSample) maxSample = abs;
            }
            
            if (maxSample > 0.9) {
                for (let i = 0; i < mono.length; i++) {
                    if (Math.abs(mono[i]) > 0.5) {
                        mono[i] *= 0.3;
                    }
                }
            }
            
            // Downsample to 16kHz
            const int16 = this.audioHelpers.downsampleTo16kInt16(mono, sampleRate);
            
            // Send PCM16 data to Cartesia
            try {
                const audioData = Array.from(new Uint8Array(int16.buffer));
                await this.invoke('send_streaming_audio', {
                    sessionId: this.sessionId,
                    audioData: audioData
                });
            } catch (error) {
                console.error('[Cartesia] Failed to send audio:', error);
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
                console.error('[Cartesia] Failed to stop session:', error);
            }
            this.sessionId = null;
        }
        
        this.isActive = false;
    }
}
