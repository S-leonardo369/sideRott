const { app, Tray, Menu, globalShortcut, screen, ipcMain, nativeImage, shell, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const windowManager = require('./window-manager');
const { DEFAULT_CONFIG } = require('../shared/config');
const { resolveStreamUrl } = require('./video-resolver');

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let tray = null;
let settingsWindow = null;
let config = {};
const configPath = path.join(app.getPath('userData'), 'brainrot.config.json');

// ── Config Management ──

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(newConfig) {
  config = { ...config, ...newConfig };
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

// ── Tray Icon ──

function createTrayIcon() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icons', 'tray-icon.png')
    : path.join(__dirname, '..', '..', 'assets', 'icons', 'tray-icon.png');

  const icon = nativeImage.createFromPath(iconPath);
  return icon.resize({ width: 16, height: 16 });
}

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('sideRott');

  updateTrayMenu();
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Settings',
      click: () => openSettings()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        windowManager.destroyOverlay();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// ── Hotkey Registration ──

function registerHotkey() {
  globalShortcut.unregisterAll();

  const hotkey = config.hotkey || DEFAULT_CONFIG.hotkey;
  const fallback = config.fallbackHotkey || DEFAULT_CONFIG.fallbackHotkey;

  let registered = false;

  try {
    registered = globalShortcut.register(hotkey, () => {
      windowManager.toggleOverlay(config);
    });
  } catch (e) {
    console.error('Failed to register primary hotkey:', e);
  }

  if (!registered) {
    console.warn(`Primary hotkey ${hotkey} unavailable, trying fallback ${fallback}`);
    try {
      registered = globalShortcut.register(fallback, () => {
        windowManager.toggleOverlay(config);
      });
      if (registered && tray) {
        tray.displayBalloon({
          title: 'sideRott',
          content: `Hotkey conflict — using ${fallback.replace('CommandOrControl', 'Ctrl')} instead.`
        });
      }
    } catch (e) {
      console.error('Failed to register fallback hotkey:', e);
    }
  }

  return registered;
}

// ── Settings Window ──

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 520,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'sideRott',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'settings', 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// ── IPC Handlers ──

function setupIPC() {
  ipcMain.handle('config:get', () => {
    return config;
  });

  ipcMain.handle('config:set', (_event, newConfig) => {
    const oldHotkey = config.hotkey;
    saveConfig(newConfig);

    if (newConfig.hotkey && newConfig.hotkey !== oldHotkey) {
      registerHotkey();
    }

    if (newConfig.launchOnStartup !== undefined) {
      app.setLoginItemSettings({
        openAtLogin: newConfig.launchOnStartup,
        path: app.getPath('exe')
      });
    }

    const overlay = windowManager.getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send('config:updated', config);
    }

    windowManager.repositionOverlay(config);
    return config;
  });

  ipcMain.handle('overlay:close', () => {
    windowManager.hideOverlay(config);
  });

  ipcMain.handle('app:get-paths', () => {
    const resourcesPath = app.isPackaged
      ? path.join(process.resourcesPath)
      : path.join(__dirname, '..', '..');

    return {
      clips: app.isPackaged
        ? path.join(process.resourcesPath, 'clips')
        : path.join(resourcesPath, 'assets', 'clips'),
      thumbnails: app.isPackaged
        ? path.join(process.resourcesPath, 'thumbnails')
        : path.join(resourcesPath, 'assets', 'thumbnails')
    };
  });

  ipcMain.handle('video:resolve-stream', async (_event, sourceUrl) => {
    try {
      return await resolveStreamUrl(sourceUrl);
    } catch (e) {
      console.error('[IPC] Stream resolution failed:', e.message);
      return { error: e.message };
    }
  });

  ipcMain.handle('settings:record-hotkey', () => {
    // This is handled in the settings renderer
    return true;
  });
}

// ── Display Change Handling ──

function watchDisplayChanges() {
  screen.on('display-added', () => windowManager.repositionOverlay(config));
  screen.on('display-removed', () => windowManager.repositionOverlay(config));
  screen.on('display-metrics-changed', () => windowManager.repositionOverlay(config));
}

// ── App Lifecycle ──

app.on('ready', () => {
  config = loadConfig();

  // Set startup behavior
  if (config.launchOnStartup) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe')
    });
  }

  setupIPC();
  createTray();
  registerHotkey();
  watchDisplayChanges();

  // Pre-create overlay window (hidden) for instant show
  windowManager.createOverlayWindow(config);
});

app.on('second-instance', () => {
  // If user tries to launch again, toggle the overlay
  windowManager.toggleOverlay(config);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Don't quit — the app lives in the system tray
});
