// Tauri API wrappers for consistent usage across windows

export const TauriAPI = {
    // Check if Tauri is available
    isAvailable() {
        return !!window.__TAURI__;
    },

    // Get invoke function
    getInvoke() {
        return window.__TAURI__?.core?.invoke;
    },

    // Get listen function
    getListen() {
        return window.__TAURI__?.event?.listen;
    },

    // Transcription commands
    async transcribeAudio(audioData, apiKey) {
        const invoke = this.getInvoke();
        return await invoke('transcribe_audio', { audioData, apiKey });
    },

    // Text injection commands
    async insertText(text) {
        const invoke = this.getInvoke();
        return await invoke('insert_text', { text });
    },

    // Window commands
    async preventFocus() {
        const invoke = this.getInvoke();
        return await invoke('prevent_focus');
    },

    // Event listeners
    onToggleRecording(callback) {
        const listen = this.getListen();
        return listen('toggle-recording', callback);
    }
};
