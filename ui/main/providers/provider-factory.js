/**
 * Provider Factory
 * Creates appropriate provider instance based on service name
 */

import { GroqProvider } from './groq-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { MistralProvider } from './mistral-provider.js';
import { SambaNovaProvider } from './sambanova-provider.js';
import { FireworksProvider } from './fireworks-provider.js';
import { DeepgramProvider } from './deepgram-provider.js';
import { CartesiaProvider } from './cartesia-provider.js';

/**
 * Create a provider instance
 * @param {string} serviceName - The API service name (e.g., 'groq', 'deepgram')
 * @param {Object} config - Provider configuration
 * @param {string} config.apiKey - API key for the service
 * @param {string} config.language - Language code or 'multilingual'
 * @param {boolean} config.smartFormat - Enable smart formatting
 * @param {string} config.insertionMode - Text insertion mode ('typing' or 'clipboard')
 * @param {boolean} config.voiceCommandsEnabled - Enable voice commands
 * @param {Function} config.invoke - Tauri invoke function
 * @param {Object} config.audioHelpers - Audio processing helper functions
 * @returns {BaseProvider}
 */
export function createProvider(serviceName, config) {
    switch (serviceName.toLowerCase()) {
        case 'groq':
            return new GroqProvider(config);
        
        case 'gemini':
            return new GeminiProvider(config);
        
        case 'mistral':
            return new MistralProvider(config);
        
        case 'sambanova':
            return new SambaNovaProvider(config);
        
        case 'fireworks':
            return new FireworksProvider(config);
        
        case 'deepgram':
            return new DeepgramProvider(config);
        
        case 'cartesia':
            return new CartesiaProvider(config);
        
        default:
            throw new Error(`Unknown provider: ${serviceName}`);
    }
}

/**
 * Get list of available providers
 * @returns {Array<string>}
 */
export function getAvailableProviders() {
    return [
        'groq',
        'gemini',
        'mistral',
        'sambanova',
        'fireworks',
        'deepgram',
        'cartesia'
    ];
}

/**
 * Check if provider is streaming
 * @param {string} serviceName
 * @returns {boolean}
 */
export function isStreamingProvider(serviceName) {
    return ['deepgram', 'cartesia'].includes(serviceName.toLowerCase());
}
