/**
 * Batch Provider Base Class
 * Handles segmentation-based transcription for non-streaming providers
 */

import { BaseProvider } from './base-provider.js';

const { listen } = window.__TAURI__?.event || {};

export class BatchProvider extends BaseProvider {
    constructor(config) {
        super(config);
        
        // VAD session management
        this.vadSessionId = null;
        this.unlistenSegment = null;
        this.isProcessing = false;
        
        // Audio processing helpers (passed from main.js)
        this.audioHelpers = config.audioHelpers;
        
        // PTT mode: buffer all audio for single transcription
        this.pttAudioBuffer = [];
    }

    getType() {
        return 'batch';
    }

    /**
     * Start batch transcription (VAD-based or PTT mode)
     */
    async start(audioCaptureManager, visualizer) {
        this.isActive = true;
        
        if (this.pushToTalkEnabled) {
            // Push-to-talk mode: buffer all audio without VAD segmentation
            console.log(`[${this.getName()}] Starting in push-to-talk mode (no VAD)`);
            this.pttAudioBuffer = [];
            
            // Start audio capture with simple buffering callback
            const audioContext = await audioCaptureManager.start(
                async (audioData, sampleRate) => {
                    const mono = audioData; // Already mono from worklet
                    
                    // Downsample to 16kHz PCM16
                    const int16 = this.audioHelpers.downsampleTo16kInt16(mono, sampleRate);
                    
                    // Buffer audio for later transcription
                    this.pttAudioBuffer.push(int16);
                }
            );
            
            // Setup visualizer
            visualizer.connect(audioContext, audioCaptureManager.getSourceNode());
            visualizer.start();
        } else {
            // Standard mode: VAD-based segmentation
            console.log(`[${this.getName()}] Starting with VAD segmentation`);
            
            // Create VAD session for this recording
            this.vadSessionId = `vad_${Date.now()}`;
            await this.invoke('vad_create_session', {
                sessionId: this.vadSessionId,
                threshold: null,  // Use default 0.3
                silenceDurationMs: null  // Use default 400ms (optimized for speed)
            });
            
            // Listen for speech segments from VAD
            this.unlistenSegment = await listen('speech_segment_ready', async (event) => {
                if (event.payload.session_id !== this.vadSessionId) return;
                
                const audioData = event.payload.audio_data;
                const durationMs = event.payload.duration_ms;
                
                // Convert PCM16 bytes to WAV and transcribe
                await this.processVadSegment(audioData);
            });
            
            // Start audio capture with VAD callback
            const audioContext = await audioCaptureManager.start(
                async (audioData, sampleRate) => {
                    if (!this.vadSessionId) return;
                    
                    const mono = audioData; // Already mono from worklet
                    
                    // Downsample to 16kHz PCM16
                    const int16 = this.audioHelpers.downsampleTo16kInt16(mono, sampleRate);
                    
                    // Send to VAD thread (non-blocking)
                    try {
                        await this.invoke('vad_push_frame', {
                            sessionId: this.vadSessionId,
                            audioData: Array.from(new Uint8Array(int16.buffer))
                        });
                    } catch (error) {
                        console.error(`[${this.getName()}] VAD push frame error:`, error);
                    }
                }
            );
            
            // Setup visualizer
            visualizer.connect(audioContext, audioCaptureManager.getSourceNode());
            visualizer.start();
        }
    }

    /**
     * Process VAD-detected speech segment
     */
    async processVadSegment(pcm16Bytes) {
        if (this.isProcessing) {
            console.warn(`[${this.getName()}] Skipping segment - already processing`);
            return;
        }
        
        this.isProcessing = true;
        
        try {
            // Convert PCM16 bytes to Int16Array
            const int16Array = new Int16Array(
                pcm16Bytes.buffer || new Uint8Array(pcm16Bytes).buffer
            );
            
            // Encode as WAV
            const wavBytes = this.audioHelpers.encodeWav16kMono(int16Array);
            
            // Send to transcription API
            await this.transcribeSegment(wavBytes);
        } catch (error) {
            console.error(`[${this.getName()}] VAD segment processing error:`, error);
        } finally {
            this.isProcessing = false;
        }
    }


    /**
     * Transcribe audio segment (must be implemented by concrete provider)
     * @param {Uint8Array} wavBytes
     */
    async transcribeSegment(wavBytes) {
        throw new Error('transcribeSegment() must be implemented by provider');
    }

    /**
     * Stop batch transcription
     */
    async stop() {
        if (this.pushToTalkEnabled) {
            // Push-to-talk mode: transcribe entire buffered audio
            if (this.pttAudioBuffer.length > 0) {
                try {
                    console.log(`[${this.getName()}] PTT mode: processing ${this.pttAudioBuffer.length} chunks`);
                    
                    // Concatenate all buffered chunks
                    const totalSamples = this.pttAudioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
                    const combinedBuffer = new Int16Array(totalSamples);
                    let offset = 0;
                    
                    for (const chunk of this.pttAudioBuffer) {
                        combinedBuffer.set(chunk, offset);
                        offset += chunk.length;
                    }
                    
                    // Encode as WAV and transcribe
                    const wavBytes = this.audioHelpers.encodeWav16kMono(combinedBuffer);
                    await this.transcribeSegment(wavBytes);
                    
                    // Clear buffer
                    this.pttAudioBuffer = [];
                } catch (error) {
                    console.error(`[${this.getName()}] PTT transcription error:`, error);
                }
            }
        } else {
            // Standard mode: stop VAD and get final segment if any
            if (this.vadSessionId) {
                try {
                    const finalAudio = await this.invoke('vad_stop_session', {
                        sessionId: this.vadSessionId
                    });
                    
                    if (finalAudio && finalAudio.length > 0) {
                        await this.processVadSegment(finalAudio);
                    }
                    
                    await this.invoke('vad_destroy_session', {
                        sessionId: this.vadSessionId
                    });
                } catch (error) {
                    console.error(`[${this.getName()}] VAD stop error:`, error);
                }
                
                this.vadSessionId = null;
            }
            
            // Cleanup segment listener
            if (this.unlistenSegment) {
                this.unlistenSegment();
                this.unlistenSegment = null;
            }
        }
        
        // Reset state
        this.isActive = false;
        this.isProcessing = false;
    }
}
