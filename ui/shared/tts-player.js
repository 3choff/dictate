/**
 * TtsPlayer
 * Shared text-to-speech playback module.
 * Invokes the backend `tts_speak` command (60dB or ElevenLabs provider,
 * resolved from settings) and plays the returned audio via Web Audio:
 * - LINEAR16: raw PCM 16-bit signed little-endian, mono, at `sample_rate`
 * - MP3: decoded with AudioContext.decodeAudioData
 */

const { invoke } = window.__TAURI__?.core || {};

export class TtsPlayer {
    constructor(invokeFn) {
        this.invoke = invokeFn || invoke;
        this.audioContext = null;
        this.currentSource = null;
        this.speakingPromise = null;
    }

    /**
     * Synthesize and play `text`. Replaces any playback in progress.
     * @param {string} text
     * @returns {Promise<void>} resolves when playback starts (not when it ends)
     */
    async speak(text) {
        this.stop();

        const result = await this.invoke('tts_speak', { text });
        this.play(result);
    }

    /**
     * Play a TtsAudioResult payload
     * @param {Object} result - { audio_base64, sample_rate, encoding }
     */
    async play(result) {
        this.stop();

        // Decode base64 to bytes
        const binary = atob(result.audio_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        if (!this.audioContext) {
            this.audioContext = new AudioContext();
        }
        const ctx = this.audioContext;
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        let buffer;
        if (result.encoding === 'MP3') {
            // Compressed audio: let the browser decode (sample rate embedded)
            buffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
        } else {
            // LINEAR16 raw PCM: convert Int16 -> Float32
            const sampleRate = result.sample_rate || 24000;
            const int16 = new Int16Array(bytes.buffer.slice(0));
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
            buffer = ctx.createBuffer(1, float32.length, sampleRate);
            buffer.getChannelData(0).set(float32);
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
            if (this.currentSource === source) this.currentSource = null;
        };
        source.start();
        this.currentSource = source;
    }

    /**
     * Stop current playback (if any)
     */
    stop() {
        if (this.currentSource) {
            try { this.currentSource.stop(); } catch (_) { /* already stopped */ }
            this.currentSource = null;
        }
    }

    /**
     * Check if audio is currently playing
     */
    get active() {
        return this.currentSource !== null;
    }
}
