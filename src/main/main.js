const { app, Tray, Menu, globalShortcut, screen, ipcMain, nativeImage, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const windowManager = require('./window-manager');
const { DEFAULT_CONFIG } = require('../shared/config');
const { resolveStreamUrl } = require('./video-resolver');

// ── Windows identity — must be set before app ready ──
// Required for: Windows Store listing, system notifications, taskbar grouping
app.setAppUserModelId('com.siderott.app');

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let tray = null;
let settingsWindow = null;
let config = {};
const configPath = path.join(app.getPath('userData'), 'siderott.config.json');

// ── Crash / uncaught exception handlers ──
// Prevents the app from silently dying in production

process.on('uncaughtException', (err) => {
  console.error('[sideRott] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[sideRott] Unhandled rejection:', reason);
});

// ── Config Management ──

function loadConfig() {
  // Migrate from old config filename if present
  const oldConfigPath = path.join(app.getPath('userData'), 'brainrot.config.json');
  if (!fs.existsSync(configPath) && fs.existsSync(oldConfigPath)) {
    try { fs.renameSync(oldConfigPath, configPath); } catch (_) {}
  }

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
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'icons')
    : path.join(__dirname, '..', '..', 'assets', 'icons');

  // Provide both 1x (32px) and 2x (64px) so Windows picks the right size
  // for 100%/125%/150%/200% DPI scaling. Do NOT hard-resize — let Windows decide.
  const icon = nativeImage.createEmpty();
  const img1x = nativeImage.createFromPath(path.join(base, 'tray-icon.png'));
  const img2x = nativeImage.createFromPath(path.join(base, 'tray-icon@2x.png'));
  if (!img1x.isEmpty()) icon.addRepresentation({ scaleFactor: 1.0, ...img1x.getSize(), buffer: img1x.toPNG() });
  if (!img2x.isEmpty()) icon.addRepresentation({ scaleFactor: 2.0, ...img2x.getSize(), buffer: img2x.toPNG() });
  return icon.isEmpty() ? img1x : icon;
}

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('sideRott');
  updateTrayMenu();
}

function updateTrayMenu() {
  const hotkey = (config.hotkey || DEFAULT_CONFIG.hotkey)
    .replace('CommandOrControl', 'Ctrl');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Show / Hide  (${hotkey})`,
      click: () => windowManager.toggleOverlay(config)
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => openSettings()
    },
    { type: 'separator' },
    {
      label: 'Quit sideRott',
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
          content: `Hotkey conflict — using ${fallback.replace('CommandOrControl', 'Ctrl')} instead.`,
          noSound: true
        });
      }
    } catch (e) {
      console.error('Failed to register fallback hotkey:', e);
    }
  }

  // Keep tray menu label in sync with whatever hotkey is active
  updateTrayMenu();

  return registered;
}

// ── First-Run Welcome ──

function showFirstRunNotification() {
  if (config.hasShownWelcome) return;

  saveConfig({ hasShownWelcome: true });

  // Small delay so the tray icon is settled before the balloon appears
  setTimeout(() => {
    if (tray && !tray.isDestroyed()) {
      const hotkey = (config.hotkey || DEFAULT_CONFIG.hotkey)
        .replace('CommandOrControl', 'Ctrl');
      tray.displayBalloon({
        title: 'sideRott is running',
        content: `Press ${hotkey} to open the overlay`,
        noSound: true
      });
    }
  }, 1500);
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

  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
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

  // Welcome notification on first run
  showFirstRunNotification();
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
