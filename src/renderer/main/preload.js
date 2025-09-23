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
});
