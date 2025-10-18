/**
 * RecordingSession
 * Unified lifecycle manager for audio capture and transcription
 * Encapsulates AudioCaptureManager, Provider, and Visualizer
 */

export class RecordingSession {
    constructor(provider, audioCaptureManager, visualizer) {
        this.provider = provider;
        this.audioCaptureManager = audioCaptureManager;
        this.visualizer = visualizer;
        this.isActive = false;
    }

    /**
     * Start the recording session
     * Coordinates provider and audio capture startup
     */
    async start() {
        if (this.isActive) {
            console.warn('[Session] Already active');
            return;
        }

        try {
            console.log(`[Session] Starting with provider: ${this.provider.getName()}`);
            
            // Start provider (handles both audio capture and transcription)
            await this.provider.start(this.audioCaptureManager, this.visualizer);
            
            this.isActive = true;
            console.log('[Session] Started successfully');
            
        } catch (error) {
            console.error('[Session] Failed to start:', error);
            this.isActive = false;
            throw error;
        }
    }

    /**
     * Stop the recording session
     * Coordinates cleanup of provider, visualizer, and audio capture
     */
    async stop() {
        if (!this.isActive) {
            console.warn('[Session] Not active');
            return;
        }

        console.log('[Session] Stopping...');
        this.isActive = false;

        try {
            // Stop provider first (processes final segments, closes connections)
            if (this.provider) {
                try {
                    await this.provider.stop();
                } catch (error) {
                    console.error('[Session] Error stopping provider:', error);
                }
            }

            // Stop visualizer
            if (this.visualizer) {
                try {
                    this.visualizer.stop();
                } catch (error) {
                    console.error('[Session] Error stopping visualizer:', error);
                }
            }

            // Stop audio capture (but keep mic warm)
            if (this.audioCaptureManager) {
                try {
                    await this.audioCaptureManager.stop();
                } catch (error) {
                    console.error('[Session] Error stopping audio capture:', error);
                }
            }

            console.log('[Session] Stopped successfully');

        } catch (error) {
            console.error('[Session] Error during stop:', error);
        }
    }

    /**
     * Complete cleanup - release microphone
     * Call this on app shutdown or when mic won't be needed soon
     */
    async cleanup() {
        console.log('[Session] Cleaning up...');
        
        await this.stop();
        
        if (this.audioCaptureManager) {
            try {
                await this.audioCaptureManager.cleanup();
            } catch (error) {
                console.error('[Session] Error during cleanup:', error);
            }
        }
        
        console.log('[Session] Cleanup complete');
    }

    /**
     * Check if session is currently active
     */
    get active() {
        return this.isActive;
    }

    /**
     * Get provider type ('batch' or 'streaming')
     */
    getProviderType() {
        return this.provider?.getType();
    }

    /**
     * Get provider name
     */
    getProviderName() {
        return this.provider?.getName();
    }
}
