const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.send('set-settings', settings),
  closeSettingsWindow: () => ipcRenderer.send('close-settings-window'),
});
