/**
 * Batch Provider Base Class
 * Handles segmentation-based transcription for non-streaming providers
 */

import { BaseProvider } from './base-provider.js';

export class BatchProvider extends BaseProvider {
    constructor(config) {
        super(config);
        
        // Segmentation state
        this.segmentationActive = false;
        this.segmentSamples16k = [];
        this.segmentLastBoundary = 0;
        this.segmentInSilenceMs = 0;
        this.segmentHadSpeech = false;
        this.segmentIsProcessing = false;
        
        // Segmentation constants
        this.SEGMENT_SILENCE_MS = 700;
        this.SEGMENT_SILENCE_DB = -40;  // Lower threshold for quieter laptop mics (was -30)
        this.SEGMENT_MAX_DURATION_MS = 15000;
        this.SEGMENT_MIN_DURATION_MS = 200;
        
        // Audio processing helpers (passed from main.js)
        this.audioHelpers = config.audioHelpers;
    }

    getType() {
        return 'batch';
    }

    /**
     * Start batch transcription with segmentation
     */
    async start(audioCaptureManager, visualizer) {
        this.isActive = true;
        this.segmentationActive = true;
        this.segmentSamples16k = [];
        this.segmentLastBoundary = 0;
        this.segmentInSilenceMs = 0;
        this.segmentHadSpeech = false;
        this.segmentIsProcessing = false;

        // Start audio capture with segmentation callback
        const audioContext = await audioCaptureManager.start((audioData, sampleRate) => {
            if (!this.segmentationActive) return;
            
            this.processAudioChunk(audioData, sampleRate);
        });

        // Setup visualizer
        visualizer.connect(audioContext, audioCaptureManager.getSourceNode());
        visualizer.start();
    }

    /**
     * Process audio chunk for segmentation
     */
    processAudioChunk(audioData, sampleRate) {
        const mono = audioData; // Already mono from worklet
        
        // Calculate RMS and dB for silence detection
        let sumSq = 0;
        for (let i = 0; i < mono.length; i++) {
            const s = mono[i];
            sumSq += s * s;
        }
        const rms = Math.sqrt(sumSq / Math.max(1, mono.length));
        const db = this.audioHelpers.dbfsFromRms(rms);
        const frameMs = (mono.length / sampleRate) * 1000;
        
        // Silence detection
        if (db < this.SEGMENT_SILENCE_DB) {
            this.segmentInSilenceMs += frameMs;
        } else {
            this.segmentInSilenceMs = 0;
            this.segmentHadSpeech = true;
        }
        
        // Downsample to 16kHz and accumulate
        const int16 = this.audioHelpers.downsampleTo16kInt16(mono, sampleRate);
        for (let i = 0; i < int16.length; i++) {
            this.segmentSamples16k.push(int16[i]);
        }
        
        const currentIndex = this.segmentSamples16k.length;
        const currentMsSinceBoundary = ((currentIndex - this.segmentLastBoundary) / 16000) * 1000;
        
        // Emit segment on silence or max duration
        if (this.segmentInSilenceMs >= this.SEGMENT_SILENCE_MS && this.segmentHadSpeech && !this.segmentIsProcessing) {
            this.emitSegment(currentIndex);
        } else if (this.segmentHadSpeech && currentMsSinceBoundary >= this.SEGMENT_MAX_DURATION_MS && !this.segmentIsProcessing) {
            this.emitSegment(currentIndex);
        }
    }

    /**
     * Emit audio segment for transcription
     */
    async emitSegment(boundaryIndex) {
        if (this.segmentIsProcessing) return;
        
        const samplesSinceBoundary = boundaryIndex - this.segmentLastBoundary;
        const msSinceBoundary = (samplesSinceBoundary / 16000) * 1000;
        
        if (!this.segmentHadSpeech || msSinceBoundary < this.SEGMENT_MIN_DURATION_MS) {
            return;
        }
        
        const seg = this.segmentSamples16k.slice(this.segmentLastBoundary, boundaryIndex);
        const wavBytes = this.audioHelpers.encodeWav16kMono(Int16Array.from(seg));
        
        // Mark as processing
        this.segmentIsProcessing = true;
        
        // Update boundary and reset state BEFORE sending
        this.segmentLastBoundary = boundaryIndex;
        this.segmentHadSpeech = false;
        this.segmentInSilenceMs = 0;
        
        // Drop older samples
        if (this.segmentLastBoundary > 0) {
            this.segmentSamples16k = this.segmentSamples16k.slice(this.segmentLastBoundary);
            this.segmentLastBoundary = 0;
        }
        
        // Send to backend (provider-specific)
        try {
            await this.transcribeSegment(wavBytes);
        } catch (error) {
            console.error(`[${this.getName()}] Transcription error:`, error);
        } finally {
            this.segmentIsProcessing = false;
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
        // Emit final segment if any
        try {
            const currentIndex = this.segmentSamples16k.length;
            const msSinceBoundary = ((currentIndex - this.segmentLastBoundary) / 16000) * 1000;
            
            if (this.segmentHadSpeech && msSinceBoundary >= this.SEGMENT_MIN_DURATION_MS && !this.segmentIsProcessing) {
                await this.emitSegment(currentIndex);
            }
        } catch (error) {
            console.error(`[${this.getName()}] Error emitting final segment:`, error);
        }
        
        // Reset state
        this.isActive = false;
        this.segmentationActive = false;
        this.segmentSamples16k = [];
        this.segmentLastBoundary = 0;
        this.segmentInSilenceMs = 0;
        this.segmentHadSpeech = false;
        this.segmentIsProcessing = false;
    }
}
