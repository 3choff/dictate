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
     * Split frequency data into 9 logarithmic buckets
     * Uses logarithmic distribution to spread energy across all bars
     * This matches human hearing perception and ensures all bars are active
     */
    splitIntoBuckets(freqData) {
        const buckets = new Array(9).fill(0);
        const dataLength = freqData.length;
        
        // Logarithmic bucketing: bar 0 (left) = bass, bar 8 (right) = treble
        // Use steeper log curve to push high frequencies more to the right
        
        const minLog = Math.log(1);
        const maxLog = Math.log(dataLength);
        const logRange = maxLog - minLog;
        
        for (let i = 0; i < 9; i++) {
            // Apply exponential skew to push high frequencies further right
            // i/9 ranges from 0 to 1, raise to power to make curve steeper
            const skewedRatio = Math.pow(i / 9, 0.7); // Lower power = steeper curve
            const skewedRatioNext = Math.pow((i + 1) / 9, 0.7);
            
            const startLog = minLog + skewedRatio * logRange;
            const endLog = minLog + skewedRatioNext * logRange;
            
            const start = Math.max(1, Math.round(Math.exp(startLog)));
            const end = Math.min(dataLength, Math.round(Math.exp(endLog)));
            
            // Use peak value instead of average for better responsiveness
            let peak = 0;
            let sum = 0;
            let count = 0;
            
            for (let j = start; j < end; j++) {
                const value = freqData[j];
                sum += value;
                count++;
                if (value > peak) peak = value;
            }
            
            // Use weighted combination of peak and average
            const avg = count > 0 ? sum / count : 0;
            const combined = peak * 0.7 + avg * 0.3;
            
            // Apply boost to higher frequency buckets (compensate for natural rolloff)
            const boost = 1 + (i / 9) * 0.8; // Progressive boost for higher frequencies
            
            buckets[i] = Math.min(1.0, (combined / 255.0) * boost);
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
