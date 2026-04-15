/**
 * VideoResolver — Uses yt-dlp to resolve direct stream URLs from YouTube.
 *
 * Tries two approaches:
 *   1. Run yt-dlp.exe directly (pip-installed entry point)
 *   2. Fall back to `python -m yt_dlp` (always works if pip-installed)
 *
 * URLs are cached for 2 hours (YouTube CDN URLs expire after ~6h).
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── Locate yt-dlp.exe on disk (no execution, just file check) ──

function findYtDlpExe() {
  const candidates = [
    path.join(process.env.APPDATA || '', 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.APPDATA || '', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.APPDATA || '', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.APPDATA || '', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
    'C:\\yt-dlp\\yt-dlp.exe',
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey', 'bin', 'yt-dlp.exe'),
    path.join(process.env.USERPROFILE || '', 'scoop', 'shims', 'yt-dlp.exe'),
  ];

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

// Cache resolved URLs
const urlCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Run yt-dlp with the given args. Tries the .exe first, falls back to python -m.
 */
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const exePath = findYtDlpExe();

    // Attempt 1: direct .exe
    if (exePath) {
      execFile(exePath, args, {
        timeout: 15000,
        maxBuffer: 1024 * 64,
        windowsHide: true
      }, (err, stdout) => {
        if (!err && stdout.trim()) {
          resolve(stdout.trim());
          return;
        }
        console.warn(`[VideoResolver] Direct .exe failed (${err?.code || 'no output'}), trying python -m`);
        // Fall through to attempt 2
        runViaPython(args).then(resolve).catch(reject);
      });
      return;
    }

    // Attempt 2: python -m yt_dlp
    console.log('[VideoResolver] No .exe found, using python -m yt_dlp');
    runViaPython(args).then(resolve).catch(reject);
  });
}

function runViaPython(args) {
  return new Promise((resolve, reject) => {
    execFile('python', ['-m', 'yt_dlp', ...args], {
      timeout: 15000,
      maxBuffer: 1024 * 64,
      windowsHide: true
    }, (err, stdout) => {
      if (err) {
        reject(new Error(`python -m yt_dlp failed: ${err.message}`));
        return;
      }
      resolve(stdout.trim());
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
