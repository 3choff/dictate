// AudioWorkletProcessor for audio capture and processing
// This replaces the deprecated ScriptProcessorNode

class AudioCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    // Mix multi-channel to mono
    mixToMono(input) {
        const numChannels = input.length;
        if (numChannels === 0) return new Float32Array(0);
        
        const channelLength = input[0].length;
        const mono = new Float32Array(channelLength);
        
        if (numChannels === 1) {
            // Already mono
            mono.set(input[0]);
        } else {
            // Mix multiple channels
            for (let i = 0; i < channelLength; i++) {
                let sum = 0;
                for (let ch = 0; ch < numChannels; ch++) {
                    sum += input[ch][i];
                }
                mono[i] = sum / numChannels;
            }
        }
        
        return mono;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        
        // If no input, do nothing
        if (!input || input.length === 0) {
            return true;
        }

        // Mix to mono
        const monoData = this.mixToMono(input);
        
        // Accumulate samples into buffer
        for (let i = 0; i < monoData.length; i++) {
            this.buffer[this.bufferIndex++] = monoData[i];
            
            // When buffer is full, send to main thread
            if (this.bufferIndex >= this.bufferSize) {
                // Send copy of buffer to main thread
                this.port.postMessage({
                    audioData: this.buffer.slice(0, this.bufferIndex),
                    sampleRate: sampleRate
                });
                
                // Reset buffer
                this.bufferIndex = 0;
            }
        }

        return true; // Keep processor alive
    }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
