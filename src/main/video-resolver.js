/**
 * VideoResolver — Uses yt-dlp to resolve direct stream URLs from YouTube.
 *
 * Returns a direct CDN URL for <video> element playback.
 * URLs are cached for 2 hours (YouTube CDN URLs expire after ~6h).
 *
 * NOTE: We use exec() (shell) instead of execFile() because pip-installed
 * yt-dlp.exe is a launcher stub that execFile() can't run inside Electron.
 * We also inject Python paths into the child process environment because
 * Electron may not inherit the same PATH as the user's interactive shell.
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Cache resolved URLs
const urlCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

// Cache the working command so we don't re-discover every call
let _cachedCommand = null;

/**
 * Build an environment object with Python paths guaranteed to be present.
 * This is necessary because Electron's child processes may not inherit
 * the user's full interactive shell PATH.
 */
function buildEnv() {
  const env = { ...process.env };
  const appData = env.APPDATA || '';
  const extraPaths = [];

  // Add pip user-scripts dirs for common Python versions
  for (const ver of ['Python314', 'Python313', 'Python312', 'Python311']) {
    const scriptsDir = path.join(appData, 'Python', ver, 'Scripts');
    if (fs.existsSync(scriptsDir)) extraPaths.push(scriptsDir);
  }

  // Add common system Python locations
  for (const pyDir of ['C:\\Python314', 'C:\\Python313', 'C:\\Python312', 'C:\\Python311']) {
    if (fs.existsSync(pyDir)) {
      extraPaths.push(pyDir);
      extraPaths.push(path.join(pyDir, 'Scripts'));
    }
  }

  // Add local-app-data Python installs
  const localAppData = env.LOCALAPPDATA || '';
  if (localAppData) {
    for (const ver of ['Python314', 'Python313', 'Python312', 'Python311']) {
      const pyDir = path.join(localAppData, 'Programs', 'Python', ver);
      if (fs.existsSync(pyDir)) {
        extraPaths.push(pyDir);
        extraPaths.push(path.join(pyDir, 'Scripts'));
      }
    }
  }

  // Prepend to PATH
  if (extraPaths.length > 0) {
    env.PATH = extraPaths.join(';') + ';' + (env.PATH || '');
  }

  // Ensure Python can find user-installed packages (pip --user)
  const userSitePackages = path.join(appData, 'Python', 'Python314', 'site-packages');
  if (fs.existsSync(userSitePackages)) {
    env.PYTHONPATH = userSitePackages + (env.PYTHONPATH ? ';' + env.PYTHONPATH : '');
  }

  return env;
}

/**
 * Returns the path to the yt-dlp binary bundled inside the app package.
 * This is the primary method — it works on any machine with no external deps.
 */
function getBundledYtDlpPath() {
  // app is available via require('electron').app in main process
  const { app } = require('electron');
  const binDir = app.isPackaged
    ? path.join(process.resourcesPath, 'bin')
    : path.join(__dirname, '..', '..', 'assets', 'bin');
  return path.join(binDir, 'yt-dlp.exe');
}

/**
 * Discover which yt-dlp invocation method works on this machine.
 * Checks the bundled binary first, then falls back to system installs.
 * Tests with --version (fast), caches the result.
 */
function discoverYtDlp() {
  if (_cachedCommand) return Promise.resolve(_cachedCommand);

  const env = buildEnv();
  const bundled = getBundledYtDlpPath();
  const candidates = [
    `"${bundled}"`,     // Bundled binary — works on any machine, no Python needed
    'yt-dlp',           // System install on PATH (fallback for dev)
    'python -m yt_dlp', // pip install fallback
  ];

  return new Promise((resolve) => {
    let idx = 0;

    function tryNext() {
      if (idx >= candidates.length) {
        console.error('[VideoResolver] Could not find a working yt-dlp. Tried:', candidates.join(', '));
        resolve(null);
        return;
      }

      const cmd = candidates[idx];
      exec(`${cmd} --version`, { timeout: 10000, env, windowsHide: true }, (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
          console.log(`[VideoResolver] Found working yt-dlp: "${cmd}" (v${stdout.trim()})`);
          _cachedCommand = cmd;
          resolve(cmd);
          return;
        }
        idx++;
        tryNext();
      });
    }

    tryNext();
  });
}

/**
 * Escape a single argument for cmd.exe shell usage.
 */
function shellArg(arg) {
  return `"${arg}"`;
}

/**
 * Run a yt-dlp command with the given arguments.
 */
async function runYtDlp(args) {
  const baseCmd = await discoverYtDlp();
  if (!baseCmd) {
    throw new Error(
      'yt-dlp not found. Install it with: pip install yt-dlp'
    );
  }

  const argsStr = args.map(shellArg).join(' ');
  const fullCmd = `${baseCmd} ${argsStr}`;
  const env = buildEnv();

  return new Promise((resolve, reject) => {
    exec(fullCmd, { timeout: 30000, maxBuffer: 1024 * 64, windowsHide: true, env }, (err, stdout, stderr) => {
      if (!err && stdout && stdout.trim()) {
        resolve(stdout.trim());
        return;
      }
      const errMsg = stderr
        ? stderr.trim().substring(0, 200)
        : (err ? err.message.substring(0, 200) : 'no output');
      reject(new Error(`yt-dlp failed: ${errMsg}`));
    });
  });
}

/**
 * Resolve a YouTube URL to a direct video stream URL.
 */
function resolveStreamUrl(sourceUrl) {
  const cached = urlCache.get(sourceUrl);
  if (cached && (Date.now() - cached.resolvedAt) < CACHE_TTL_MS) {
    return Promise.resolve({ url: cached.directUrl, format: cached.format, cached: true });
  }

  const args = [
    '-f', '299/137/298/136/best[height>=720]',
    '-g',
    '--no-playlist',
    '--no-warnings',
    sourceUrl
  ];

  return runYtDlp(args).then((output) => {
    const directUrl = output.split('\n')[0];
    if (!directUrl || !directUrl.startsWith('http')) {
      throw new Error('No valid URL returned from yt-dlp');
    }

    let format = '1080p';
    if (directUrl.includes('itag=299') || directUrl.includes('itag%3D299')) format = '1080p60';
    else if (directUrl.includes('itag=137') || directUrl.includes('itag%3D137')) format = '1080p';
    else if (directUrl.includes('itag=298') || directUrl.includes('itag%3D298')) format = '720p60';
    else if (directUrl.includes('itag=136') || directUrl.includes('itag%3D136')) format = '720p';

    urlCache.set(sourceUrl, { directUrl, format, resolvedAt: Date.now() });
    return { url: directUrl, format, cached: false };
  });
}

function clearCache() {
  urlCache.clear();
}

module.exports = { resolveStreamUrl, clearCache };
