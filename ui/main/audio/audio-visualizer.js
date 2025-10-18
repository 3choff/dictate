/**
 * Frontend Audio Visualizer using Web Audio API
 * Replaces backend FFT analysis with native AnalyserNode
 */

export class AudioVisualizer {
    constructor(barElements) {
        this.barElements = Array.from(barElements);
        this.analyser = null;
        this.dataArray = null;
        this.animationId = null;
        this.isActive = false;
        this.smoothedLevels = new Array(9).fill(0); // Smoothing buffer to reduce jitter
    }

    /**
     * Connect the visualizer to an audio source node
     * @param {AudioContext} audioContext - The audio context
     * @param {AudioNode} sourceNode - The source node to analyze
     */
    connect(audioContext, sourceNode) {
        // Create analyser node
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 1024; // Higher resolution for better frequency separation
        this.analyser.smoothingTimeConstant = 0.6; // Less smoothing for more responsiveness
        this.analyser.minDecibels = -85; // More sensitive to quiet sounds
        this.analyser.maxDecibels = -20; // Wider dynamic range
        
        // Create data array for frequency data
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        // Connect source → analyser (don't connect to destination to avoid feedback)
        sourceNode.connect(this.analyser);
    }

    /**
     * Start the visualization loop
     */
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.updateBars();
    }

    /**
     * Animation loop - updates bar heights based on audio frequencies
     */
    updateBars() {
        if (!this.isActive || !this.analyser) return;
        
        this.animationId = requestAnimationFrame(() => this.updateBars());
        
        // Get frequency data from analyser
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Split frequencies into 9 buckets using logarithmic distribution
        const buckets = this.splitIntoBuckets(this.dataArray);
        
        // Apply smoothing to reduce jitter (70% old, 30% new)
        this.smoothedLevels = this.smoothedLevels.map((prev, i) => {
            const target = buckets[i] || 0;
            return prev * 0.7 + target * 0.3;
        });
        
        // Update DOM bar heights and colors
        this.barElements.forEach((bar, i) => {
            const value = this.smoothedLevels[i];
            
            // Visually amplified formula (matching old backend logic)
            // Original: height = min(20, 4 + pow(v, 0.7) * 16)
            // Amplified: height = min(35, 4 + pow(v, 0.65) * 26)
            const height = Math.min(35, 4 + Math.pow(value, 0.65) * 26);
            bar.style.height = `${height}px`;
            
            // Set transition for smooth animation
            bar.style.transition = 'height 60ms ease-out';
            
            // Calculate opacity based on value (minimum 0.5 for visibility)
            const opacity = Math.max(0.5, value * 2);
            bar.style.opacity = opacity;
            
            // Color interpolation from blue to light blue based on intensity
            // Matches original color scheme
            const blue = { r: 0, g: 169, b: 255 };      // rgb(0, 169, 255)
            const lblue = { r: 160, g: 200, b: 248 };   // rgb(160, 200, 248)
            
            const r = Math.round(blue.r + (lblue.r - blue.r) * value);
            const g = Math.round(blue.g + (lblue.g - blue.g) * value);
            const b = Math.round(blue.b + (lblue.b - blue.b) * value);
            
            bar.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        });
    }

    /**
     * Split frequency data into 9 buckets optimized for speech visualization
     * Uses perceptual weighting to create balanced, engaging bars
     */
    splitIntoBuckets(freqData) {
        const buckets = new Array(9).fill(0);
        const dataLength = freqData.length;
        
        // Focus on speech-relevant frequency range (85 Hz - 4 kHz)
        // This creates more balanced visualization for human voice
        
        // Start from bin 2 (skip DC offset)
        const minBin = 2;
        const maxBin = Math.min(dataLength - 1, 200); // ~4kHz for speech range
        
        // Silence threshold - if overall energy is too low, return zeros
        const totalEnergy = freqData.reduce((sum, val) => sum + val, 0) / dataLength;
        if (totalEnergy < 1.5) {
            return buckets; // Return all zeros
        }
        
        const minLog = Math.log(minBin);
        const maxLog = Math.log(maxBin);
        const logRange = maxLog - minLog;
        
        for (let i = 0; i < 9; i++) {
            // Logarithmic bucket boundaries
            const startLog = minLog + (i / 9) * logRange;
            const endLog = minLog + ((i + 1) / 9) * logRange;
            
            const start = Math.round(Math.exp(startLog));
            const end = Math.round(Math.exp(endLog));
            
            // Calculate energy in this range
            let peak = 0;
            let sum = 0;
            let count = 0;
            
            for (let j = start; j < Math.min(end, maxBin); j++) {
                const value = freqData[j];
                sum += value;
                count++;
                if (value > peak) peak = value;
            }
            
            if (count === 0) {
                buckets[i] = 0;
                continue;
            }
            
            // Weighted combination: 60% peak, 40% average
            const avg = sum / count;
            const combined = peak * 0.6 + avg * 0.4;
            
            // Normalize
            const normalized = combined / 255.0;
            
            // Apply perceptual weighting curve optimized for speech
            // Boosts mid and high frequencies to create balanced visualization
            // Speech energy naturally decreases at higher frequencies, so we compensate
            const perceptualWeights = [1.0, 1.1, 1.3, 1.6, 2.0, 2.5, 3.0, 3.5, 4.0];
            const perceptualBoost = perceptualWeights[i];
            
            buckets[i] = Math.min(1.0, normalized * perceptualBoost);
        }
        
        return buckets;
    }

    /**
     * Stop the visualization and reset bars
     */
    stop() {
        this.isActive = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Reset smoothing buffer
        this.smoothedLevels = new Array(9).fill(0);
        
        // Reset all bars to inactive state (matching original styling)
        this.barElements.forEach(bar => {
            bar.style.height = '4px';
            bar.style.backgroundColor = 'rgb(68, 86, 109)';
            bar.style.opacity = '0.4';
            bar.style.transition = 'height 200ms ease-out, background-color 200ms ease-out';
        });
    }

    /**
     * Disconnect and cleanup
     */
    disconnect() {
        this.stop();
        
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
        
        this.dataArray = null;
    }
}
