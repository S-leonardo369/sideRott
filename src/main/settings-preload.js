const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('brainrot', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config) => ipcRenderer.invoke('config:set', config)
});
