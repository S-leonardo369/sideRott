// Quick diagnostic — opens the overlay with devtools to see errors
const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

app.on('ready', () => {
  const win = new BrowserWindow({
    width: 480,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'main', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  // Mock the IPC handlers the renderer expects
  const { ipcMain } = require('electron');

  const clipsDir = path.join(__dirname, '..', 'assets', 'clips');
  const thumbDir = path.join(__dirname, '..', 'assets', 'thumbnails');

  // List what files actually exist in clips/
  console.log('\n=== CLIP FILES ===');
  try {
    const clips = fs.readdirSync(clipsDir);
    clips.forEach(f => {
      const stat = fs.statSync(path.join(clipsDir, f));
      console.log(`  ${f} — ${(stat.size / 1024).toFixed(1)} KB`);
    });
    if (clips.length === 0) console.log('  (empty — no clips found!)');
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }

  console.log('\n=== THUMBNAIL FILES ===');
  try {
    const thumbs = fs.readdirSync(thumbDir);
    thumbs.forEach(f => console.log(`  ${f}`));
    if (thumbs.length === 0) console.log('  (empty)');
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }

  console.log(`\n=== PATHS ===`);
  console.log(`  clips: ${clipsDir}`);
  console.log(`  thumbs: ${thumbDir}`);

  ipcMain.handle('config:get', () => ({
    hotkey: 'CommandOrControl+Shift+B',
    overlayPosition: 'right',
    overlayWidth: 25,
    selectedVideoId: 'minecraft-parkour-01'
  }));
  ipcMain.handle('config:set', () => ({}));
  ipcMain.handle('overlay:close', () => { win.close(); });
  ipcMain.handle('app:get-paths', () => ({
    clips: clipsDir,
    thumbnails: thumbDir
  }));

  // Video stream resolution (uses yt-dlp)
  const { resolveStreamUrl } = require(path.join(__dirname, '..', 'src', 'main', 'video-resolver'));
  ipcMain.handle('video:resolve-stream', async (_event, sourceUrl) => {
    try {
      return await resolveStreamUrl(sourceUrl);
    } catch (e) {
      console.error('[Debug] Stream resolution failed:', e.message);
      return { error: e.message };
    }
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  win.webContents.openDevTools({ mode: 'detach' });

  win.webContents.on('console-message', (e, level, message) => {
    const levels = ['LOG', 'WARN', 'ERR'];
    console.log(`[RENDERER ${levels[level] || level}] ${message}`);
  });

  win.webContents.on('did-fail-load', (e, code, desc, url) => {
    console.log(`[LOAD FAIL] ${code} ${desc} — ${url}`);
  });
});

app.on('window-all-closed', () => app.quit());
