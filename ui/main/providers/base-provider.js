/**
 * Base Provider Interface
 * All transcription providers must implement this interface
 */

export class BaseProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.language = config.language || 'multilingual';
        this.smartFormat = config.smartFormat !== false;
        this.insertionMode = config.insertionMode || 'typing';
        this.voiceCommandsEnabled = config.voiceCommandsEnabled !== false;
        this.invoke = config.invoke; // Tauri invoke function
        
        // Provider state
        this.isActive = false;
        this.sessionId = null;
    }

    /**
     * Get provider type
     * @returns {'batch'|'streaming'}
     */
    getType() {
        throw new Error('getType() must be implemented by provider');
    }

    /**
     * Get provider name
     * @returns {string}
     */
    getName() {
        throw new Error('getName() must be implemented by provider');
    }

    /**
     * Start transcription session
     * @param {AudioCaptureManager} audioCaptureManager
     * @param {AudioVisualizer} visualizer
     * @returns {Promise<void>}
     */
    async start(audioCaptureManager, visualizer) {
        throw new Error('start() must be implemented by provider');
    }

    /**
     * Stop transcription session
     * @returns {Promise<void>}
     */
    async stop() {
        throw new Error('stop() must be implemented by provider');
    }

    /**
     * Check if provider is currently active
     * @returns {boolean}
     */
    get active() {
        return this.isActive;
    }
}
