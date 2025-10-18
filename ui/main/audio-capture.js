/**
 * Unified Audio Capture Module
 * Single point of microphone capture for all providers
 * Handles AudioContext, MediaStream, and AudioWorklet setup
 */

export class AudioCaptureManager {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.sourceNode = null;
        this.workletNode = null;
        this.audioWorkletLoaded = false;
        this.isActive = false;
        
        // Callbacks for audio data
        this.onAudioData = null;
    }

    /**
     * Initialize and start audio capture
     * @param {Function} onAudioData - Callback(audioData, sampleRate) for each audio chunk
     * @returns {Promise<AudioContext>} The created AudioContext
     */
    async start(onAudioData) {
        if (this.isActive) {
            console.warn('[AudioCapture] Already active');
            return this.audioContext;
        }

        this.onAudioData = onAudioData;

        try {
            // Request microphone access if needed
            if (!this.mediaStream || this.mediaStream.getTracks().length === 0 || !this.mediaStream.active) {
                this.mediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        sampleRate: 48000,
                    }
                });
            }

            // Create or reuse AudioContext
            if (!this.audioContext || this.audioContext.state === 'closed') {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.audioWorkletLoaded = false; // Need to reload AudioWorklet for new context
            }
            await this.audioContext.resume();

            // Create source from microphone stream
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Load AudioWorklet processor (modern replacement for ScriptProcessor)
            if (!this.audioWorkletLoaded) {
                await this.audioContext.audioWorklet.addModule('./audio-processor.js');
                this.audioWorkletLoaded = true;
            }

            // Create AudioWorkletNode for audio processing
            this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');

            // Handle audio data from worklet
            this.workletNode.port.onmessage = (event) => {
                if (!this.isActive) return;
                
                const { audioData, sampleRate } = event.data;
                
                // Forward to callback
                if (this.onAudioData) {
                    this.onAudioData(audioData, sampleRate);
                }
            };

            // Connect: source → worklet (no destination to avoid feedback)
            this.sourceNode.connect(this.workletNode);

            this.isActive = true;
            console.log('[AudioCapture] Started successfully');

            return this.audioContext;

        } catch (error) {
            console.error('[AudioCapture] Failed to start:', error);
            await this.cleanup();
            throw error;
        }
    }

    /**
     * Stop audio capture and cleanup resources
     */
    async stop() {
        if (!this.isActive) return;

        this.isActive = false;

        try {
            // Disconnect audio nodes
            if (this.workletNode) {
                this.workletNode.port.onmessage = null;
                this.workletNode.disconnect();
                this.workletNode = null;
            }

            if (this.sourceNode) {
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }

            // Keep AudioContext running but idle (don't suspend to preserve AudioWorklet)
            // This allows quick restart without reloading AudioWorklet

            console.log('[AudioCapture] Stopped successfully');

        } catch (error) {
            console.error('[AudioCapture] Error during stop:', error);
        }
    }

    /**
     * Release all resources (including microphone)
     * Use this when completely done with audio capture
     */
    async cleanup() {
        await this.stop();

        try {
            // Stop microphone tracks
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }

            // Close AudioContext (this invalidates AudioWorklet)
            if (this.audioContext && this.audioContext.state !== 'closed') {
                await this.audioContext.close();
                this.audioContext = null;
                this.audioWorkletLoaded = false; // Reset flag when context is closed
            }

            console.log('[AudioCapture] Cleanup complete');

        } catch (error) {
            console.error('[AudioCapture] Error during cleanup:', error);
        }
    }

    /**
     * Get the source node for connecting visualizer or other audio nodes
     * @returns {AudioNode|null}
     */
    getSourceNode() {
        return this.sourceNode;
    }

    /**
     * Get the AudioContext
     * @returns {AudioContext|null}
     */
    getAudioContext() {
        return this.audioContext;
    }

    /**
     * Get the MediaStream (useful for MediaRecorder)
     * @returns {MediaStream|null}
     */
    getMediaStream() {
        return this.mediaStream;
    }

    /**
     * Clone the MediaStream (useful for Deepgram's MediaRecorder)
     * @returns {MediaStream|null}
     */
    cloneMediaStream() {
        return this.mediaStream ? this.mediaStream.clone() : null;
    }

    /**
     * Check if audio capture is active
     * @returns {boolean}
     */
    get active() {
        return this.isActive;
    }
}
