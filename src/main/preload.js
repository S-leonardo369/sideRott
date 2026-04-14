const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('brainrot', {
  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config) => ipcRenderer.invoke('config:set', config),

  // Overlay actions
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),

  // App paths for loading assets
  getPaths: () => ipcRenderer.invoke('app:get-paths'),

  // Video stream resolution (yt-dlp in main process)
  resolveStream: (sourceUrl) => ipcRenderer.invoke('video:resolve-stream', sourceUrl),

  // Events from main process
  onPreShow: (callback) => {
    ipcRenderer.on('overlay:pre-show', () => callback());
  },
  onShown: (callback) => {
    ipcRenderer.on('overlay:shown', () => callback());
  },
  onPreHide: (callback) => {
    ipcRenderer.on('overlay:pre-hide', () => callback());
  },
  onHidden: (callback) => {
    ipcRenderer.on('overlay:hidden', () => callback());
  },
  onConfigUpdated: (callback) => {
    ipcRenderer.on('config:updated', (_event, config) => callback(config));
  }
});
