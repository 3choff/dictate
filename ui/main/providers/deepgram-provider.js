/**
 * Deepgram Provider
 * Streaming transcription using Deepgram's WebSocket API
 */

import { BaseProvider } from './base-provider.js';

export class DeepgramProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.mediaRecorder = null;
    }

    getType() {
        return 'streaming';
    }

    getName() {
        return 'deepgram';
    }

    async start(audioCaptureManager, visualizer) {
        this.isActive = true;

        // Detect preferred audio format (opus is best for Deepgram)
        let mimeType = 'audio/webm;codecs=opus';
        let encoding = 'opus';
        
        if (typeof MediaRecorder.isTypeSupported === 'function') {
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
                encoding = 'opus';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                mimeType = 'audio/webm';
                encoding = 'webm';
            }
        }
        
        // Determine language for Deepgram (use 'multi' for multilingual)
        let streamLanguage = (this.language === 'multilingual' || !this.language) ? 'multi' : this.language;
        
        // Start backend streaming session
        this.sessionId = await this.invoke('start_streaming_transcription', {
            provider: 'deepgram',
            apiKey: this.apiKey,
            language: streamLanguage,
            smartFormat: this.smartFormat,
            insertionMode: this.insertionMode,
            encoding: encoding,
            voiceCommandsEnabled: this.voiceCommandsEnabled
        });
        
        // Start audio capture (visualizer only, no audio callback needed)
        const audioContext = await audioCaptureManager.start();
        
        // Setup visualizer
        visualizer.connect(audioContext, audioCaptureManager.getSourceNode());
        visualizer.start();
        
        // Create MediaRecorder for Deepgram's encoded audio
        this.mediaRecorder = new MediaRecorder(audioCaptureManager.getMediaStream(), { mimeType: mimeType });
        
        // Capture current session ID in closure
        const currentSessionId = this.sessionId;
        
        this.mediaRecorder.ondataavailable = async (event) => {
            // Only process if this is still the active session
            if (event.data && event.data.size > 0 && this.sessionId === currentSessionId) {
                try {
                    const arrayBuffer = await event.data.arrayBuffer();
                    const audioData = Array.from(new Uint8Array(arrayBuffer));
                    
                    await this.invoke('send_streaming_audio', {
                        sessionId: currentSessionId,
                        audioData: audioData
                    });
                } catch (error) {
                    console.error('[Deepgram] Failed to send audio:', error);
                }
            }
        };
        
        this.mediaRecorder.onerror = (error) => {
            console.error('[Deepgram] MediaRecorder error:', error);
        };
        
        // Start recording with chunks every 250ms
        try {
            this.mediaRecorder.start(250);
        } catch (e) {
            this.mediaRecorder.start();
        }
    }

    async stop() {
        // Stop MediaRecorder
        if (this.mediaRecorder) {
            this.mediaRecorder.ondataavailable = null;
            this.mediaRecorder.onerror = null;
            
            if (this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }
            this.mediaRecorder = null;
        }
        
        // Close backend streaming session
        if (this.sessionId) {
            try {
                await this.invoke('stop_streaming_transcription', {
                    sessionId: this.sessionId
                });
            } catch (error) {
                console.error('[Deepgram] Failed to stop session:', error);
            }
            this.sessionId = null;
        }
        
        this.isActive = false;
    }
}
