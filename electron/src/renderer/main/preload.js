const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('close-window'),
  saveAudio: (audioData) => ipcRenderer.send('save-audio', audioData),
  saveAudioSegment: (audioData) => ipcRenderer.send('save-audio-segment', audioData),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.send('set-settings', settings),
  openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
  openExternalLink: (url) => ipcRenderer.send('open-external-link', url),
  onToggleMic: (callback) => ipcRenderer.on('toggle-mic', callback),
  onDebugMode: (callback) => ipcRenderer.on('debug-mode', (_evt, enabled) => callback(enabled)),
  // Ask main process for a file:// URL for packaged/dev assets
  getAssetFileUrl: (relativePath) => ipcRenderer.invoke('get-asset-file-url', relativePath),
  // Ask main to insert text using the configured method (native/clipboard)
  insertText: (text) => ipcRenderer.invoke('insert-text', text),
  // Get asset as base64 for reliable loading in packaged apps
  getAssetBase64: (relativePath) => ipcRenderer.invoke('get-asset-base64', relativePath),
  // Trigger grammar correction of current selection
  correctSelectionWithGemini: () => ipcRenderer.send('sparkle-correct-selection'),
  // Abort current grammar correction request (if any)
  abortSparkle: () => ipcRenderer.send('sparkle-abort'),
  onSparkleDone: (callback) => ipcRenderer.on('sparkle-correct-done', callback),
  // Listen for global shortcut to trigger sparkle
  onSparkleTrigger: (callback) => ipcRenderer.on('sparkle-trigger', callback),
  processTranscript: (text) => ipcRenderer.invoke('process-transcript', text),
  toggleCompactMode: (enabled) => ipcRenderer.send('toggle-compact-mode', enabled),
  // Listen for global shortcut to toggle view
  onToggleView: (callback) => ipcRenderer.on('toggle-view', callback),
  // Listen for restore compact mode state on load
  onRestoreCompactMode: (callback) => ipcRenderer.on('restore-compact-mode', (_evt, enabled) => callback(enabled)),
});
