/**
 * VideoResolver — Uses yt-dlp to resolve direct stream URLs from YouTube.
 *
 * Called from the main process. Returns a direct CDN URL that can be loaded
 * into a <video> element in the renderer. URLs are cached for 2 hours
 * (YouTube CDN URLs typically expire after ~6 hours).
 */

const { execFile, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── Find yt-dlp on this machine ──

const CANDIDATE_PATHS = [
  // Pip installs (user)
  path.join(process.env.APPDATA || '', 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
  path.join(process.env.APPDATA || '', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
  path.join(process.env.APPDATA || '', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
  path.join(process.env.APPDATA || '', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
  // Pip installs (system)
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
  // Standalone binary
  'C:\\yt-dlp\\yt-dlp.exe',
  // Chocolatey
  path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey', 'bin', 'yt-dlp.exe'),
  // Scoop
  path.join(process.env.USERPROFILE || '', 'scoop', 'shims', 'yt-dlp.exe'),
  // Winget / general PATH
  'yt-dlp.exe',
];

let _resolvedPath = null;

function findYtDlp() {
  if (_resolvedPath) return _resolvedPath;

  for (const candidate of CANDIDATE_PATHS) {
    try {
      if (fs.existsSync(candidate)) {
        // Verify it's actually executable
        execFileSync(candidate, ['--version'], { timeout: 5000, stdio: 'pipe' });
        _resolvedPath = candidate;
        console.log(`[VideoResolver] Found yt-dlp at: ${candidate}`);
        return candidate;
      }
    } catch {
      // Not a valid yt-dlp here, try next
    }
  }

  console.error('[VideoResolver] yt-dlp not found! Searched:', CANDIDATE_PATHS.filter(p => p).join(', '));
  return null;
}

// Cache: { url: { directUrl, resolvedAt } }
const urlCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Resolve a YouTube URL to a direct video stream URL.
 * @param {string} sourceUrl - YouTube watch URL
 * @returns {Promise<{url: string, format: string}>}
 */
function resolveStreamUrl(sourceUrl) {
  // Check cache first
  const cached = urlCache.get(sourceUrl);
  if (cached && (Date.now() - cached.resolvedAt) < CACHE_TTL_MS) {
    return Promise.resolve({ url: cached.directUrl, format: cached.format, cached: true });
  }

  const ytdlpPath = findYtDlp();
  if (!ytdlpPath) {
    return Promise.reject(new Error(
      'yt-dlp not found. Install it: pip install yt-dlp  (or download from https://github.com/yt-dlp/yt-dlp/releases)'
    ));
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-f', '299/137/298/136/best[height>=720]',
      '-g',               // print URL to stdout
      '--no-playlist',
      '--no-warnings',
      sourceUrl
    ];

    execFile(ytdlpPath, args, {
      timeout: 15000,     // 15 second timeout
      maxBuffer: 1024 * 64,
      windowsHide: true   // Don't flash a console window on Windows
    }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[VideoResolver] Failed for ${sourceUrl}:`, error.message);
        // If ENOENT, invalidate cached path so we search again
        if (error.code === 'ENOENT') {
          _resolvedPath = null;
        }
        reject(new Error(`Stream resolution failed: ${error.message}`));
        return;
      }

      const directUrl = stdout.trim().split('\n')[0];
      if (!directUrl || !directUrl.startsWith('http')) {
        reject(new Error('No valid URL returned from yt-dlp'));
        return;
      }

      // Determine format from URL
      let format = '1080p';
      if (directUrl.includes('itag=299') || directUrl.includes('itag%3D299')) format = '1080p60';
      else if (directUrl.includes('itag=137') || directUrl.includes('itag%3D137')) format = '1080p';
      else if (directUrl.includes('itag=298') || directUrl.includes('itag%3D298')) format = '720p60';
      else if (directUrl.includes('itag=136') || directUrl.includes('itag%3D136')) format = '720p';

      // Cache the result
      urlCache.set(sourceUrl, {
        directUrl,
        format,
        resolvedAt: Date.now()
      });

      resolve({ url: directUrl, format, cached: false });
    });
  });
}

/**
 * Clear the URL cache (e.g., on network change).
 */
function clearCache() {
  urlCache.clear();
}

module.exports = { resolveStreamUrl, clearCache };
