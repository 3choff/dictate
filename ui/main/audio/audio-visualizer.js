import { GlowingWave } from './glowing-wave.js';

const WAVE_RENDERERS = { glowing_wave: GlowingWave };
const LEGACY_WAVES = new Set(['glowing_wave_1', 'glowing_wave_3', 'glowing_wave_4']);

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
        
        // Cache for CSS variables (updated on theme changes)
        this.colors = this.getColorsFromCSS();
        this.container = this.barElements[0]?.parentElement;
        this.surface = this.container?.closest('.container');
        this.style = 'bars';
        this.wave = null;
        this.waves = new Map();
        this.timeData = null;
        this.waveLevel = 0;
        this.speechBands = new Array(5).fill(0);
        this.frequencyData = null;
        this.frequencyBinHz = 0;
        this.lastFrameTime = null;
    }

    setStyle(style) {
        if (LEGACY_WAVES.has(style)) style = 'glowing_wave';
        const isWave = Object.hasOwn(WAVE_RENDERERS, style);
        const next = isWave ? style : 'bars';
        const changed = next !== this.style;
        this.style = next;
        this.colors = this.getColorsFromCSS();
        if (changed && this.wave) {
            this.wave.reset();
            this.wave.container.hidden = true;
        }
        // Cache the wave canvas when switching between Bars and Glowing wave.
        const layoutStyle = isWave ? 'glowing_wave' : 'bars';
        if (this.container) {
            this.container.dataset.visualization = layoutStyle;
            if (isWave && !this.waves.has(next) && this.surface) {
                const Renderer = WAVE_RENDERERS[next];
                try {
                    this.waves.set(next, new Renderer(this.surface, this.colors));
                } catch (error) {
                    console.warn('Glowing wave unavailable; using Bars', error);
                    this.setStyle('bars');
                    return;
                }
            }
        }
        this.wave = isWave ? this.waves.get(next) : null;
        if (this.wave) this.wave.container.hidden = false;
        if (this.surface) {
            this.surface.dataset.visualization = layoutStyle;
            this.surface.classList.toggle('wave-active', this.isActive);
        }
        this.wave?.setColors(this.colors);
        if (changed) {
            this.waveLevel = 0;
            this.lastFrameTime = null;
        }
        if (!this.isActive) this.wave?.reset();
    }
    
    /**
     * Get colors from CSS variables to support theming
     */
    getColorsFromCSS() {
        const styles = getComputedStyle(document.documentElement);
        
        // Parse RGB string like "rgb(0, 169, 255)" to {r, g, b}
        const parseRGB = (rgbString) => {
            const hex = rgbString.match(/^#([\da-f]{6}|[\da-f]{3})$/i);
            if (hex) {
                const expanded = hex[1].length === 3
                    ? hex[1].split('').map(char => char + char).join('')
                    : hex[1];
                return {
                    r: parseInt(expanded.slice(0, 2), 16),
                    g: parseInt(expanded.slice(2, 4), 16),
                    b: parseInt(expanded.slice(4, 6), 16)
                };
            }
            const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
                return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
            }
            return { r: 0, g: 0, b: 0 };
        };
        
        return {
            activeFrom: parseRGB(styles.getPropertyValue('--visualizer-active-from').trim()),
            activeTo: parseRGB(styles.getPropertyValue('--visualizer-active-to').trim()),
            inactiveBg: styles.getPropertyValue('--visualizer-bar-bg').trim(),
            inactiveOpacity: styles.getPropertyValue('--visualizer-bar-opacity').trim(),
            activeOpacityMin: parseFloat(styles.getPropertyValue('--visualizer-active-opacity-min').trim())
        };
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
        this.timeData = new Float32Array(this.analyser.fftSize);
        this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
        this.frequencyBinHz = audioContext.sampleRate / this.analyser.fftSize;
        
        // Connect source → analyser (don't connect to destination to avoid feedback)
        sourceNode.connect(this.analyser);
    }

    /**
     * Start the visualization loop
     */
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.surface?.classList.add('wave-active');
        this.colors = this.getColorsFromCSS();
        this.wave?.setColors(this.colors);
        this.lastFrameTime = null;
        this.updateBars();
    }

    /**
     * Animation loop - updates bar heights based on audio frequencies
     */
    updateBars() {
        if (!this.isActive || !this.analyser) return;
        
        this.animationId = requestAnimationFrame(() => this.updateBars());

        if (this.wave) {
            // Time-domain energy bypasses the FFT smoothing used by the bars.
            // A short attack acknowledges speech promptly; a long release avoids
            // bouncing down between individual syllables and words.
            this.analyser.getFloatTimeDomainData(this.timeData);
            let sum = 0;
            let mean = 0;
            for (const sample of this.timeData) {
                sum += sample * sample;
                mean += sample;
            }
            mean /= this.timeData.length;
            const rms = Math.sqrt(Math.max(0, sum / this.timeData.length - mean * mean));
            const target = Math.pow(Math.min(1, Math.max(0, (rms - 0.004) / 0.065)), 0.6);
            const now = performance.now();
            const elapsed = this.lastFrameTime === null ? 1 / 60 : Math.min(0.05, (now - this.lastFrameTime) / 1000);
            this.lastFrameTime = now;
            const response = target > this.waveLevel ? 0.035 : 0.22;
            this.waveLevel += (target - this.waveLevel) * (1 - Math.exp(-elapsed / response));
            this.wave.update(this.waveLevel, elapsed, this.getSpeechBands());
            return;
        }
        
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
            
            // Calculate opacity based on value (minimum from CSS variable)
            const opacity = Math.max(this.colors.activeOpacityMin, value * 2);
            bar.style.opacity = opacity;
            
            // Color interpolation using theme colors
            const fromColor = this.colors.activeFrom;
            const toColor = this.colors.activeTo;
            
            const r = Math.round(fromColor.r + (toColor.r - fromColor.r) * value);
            const g = Math.round(fromColor.g + (toColor.g - fromColor.g) * value);
            const b = Math.round(fromColor.b + (toColor.b - fromColor.b) * value);
            
            bar.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        });
    }

    /** Relative spectral energy shapes the wave independently of overall loudness. */
    getSpeechBands() {
        // Float dB values avoid the display floor/ceiling of byte frequency data.
        this.analyser.getFloatFrequencyData(this.frequencyData);
        const ranges = [[85, 300], [300, 700], [700, 1500], [1500, 3000], [3000, 6000]];
        const gains = [1, 1.25, 1.65, 2.2, 2.8];
        let strongest = 0;
        ranges.forEach(([low, high], index) => {
            const start = Math.max(1, Math.floor(low / this.frequencyBinHz));
            const end = Math.min(this.frequencyData.length, Math.ceil(high / this.frequencyBinHz));
            let energy = 0;
            for (let bin = start; bin < end; bin++) {
                const decibels = this.frequencyData[bin];
                if (Number.isFinite(decibels)) energy += 10 ** (decibels / 10);
            }
            // Average linear power per band, then compensate gently for the
            // natural falloff toward consonants/high-frequency speech energy.
            const amplitude = Math.sqrt(energy / Math.max(1, end - start)) * gains[index];
            this.speechBands[index] = amplitude;
            strongest = Math.max(strongest, amplitude);
        });
        for (let index = 0; index < this.speechBands.length; index++) {
            this.speechBands[index] = strongest > 0.00005 && this.waveLevel > 0.005
                ? Math.pow(this.speechBands[index] / strongest, 0.7)
                : 0;
        }
        return this.speechBands;
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
        this.surface?.classList.remove('wave-active');
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Reset smoothing buffer
        this.smoothedLevels = new Array(9).fill(0);
        this.waveLevel = 0;
        this.lastFrameTime = null;
        
        // Update colors from CSS (in case theme changed)
        this.colors = this.getColorsFromCSS();
        this.wave?.setColors(this.colors);
        this.wave?.reset();
        
        // Reset all bars to inactive state using theme colors
        this.barElements.forEach(bar => {
            bar.style.height = '4px';
            bar.style.backgroundColor = this.colors.inactiveBg;
            bar.style.opacity = this.colors.inactiveOpacity;
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
        this.timeData = null;
        this.frequencyData = null;
    }
}
