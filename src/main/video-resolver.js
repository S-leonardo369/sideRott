/**
 * VideoResolver — Uses yt-dlp to resolve direct stream URLs from YouTube.
 *
 * Called from the main process. Returns a direct CDN URL that can be loaded
 * into a <video> element in the renderer. URLs are cached for 2 hours
 * (YouTube CDN URLs typically expire after ~6 hours).
 */

const { execFile } = require('child_process');
const path = require('path');
const { app } = require('electron');

const YTDLP_PATH = path.normalize('C:/Users/Bazuka/AppData/Roaming/Python/Python314/Scripts/yt-dlp.exe');

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

  return new Promise((resolve, reject) => {
    // Use yt-dlp to get the direct URL
    // -f: prefer 1080p60 mp4, fallback to 1080p, then 720p
    // -g: print direct URL only
    // --no-playlist: single video
    const args = [
      '-f', '299/137/298/136/best[height>=720]',
      '-g',               // print URL to stdout
      '--no-playlist',
      '--no-warnings',
      sourceUrl
    ];

    execFile(YTDLP_PATH, args, {
      timeout: 15000,     // 15 second timeout
      maxBuffer: 1024 * 64
    }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[VideoResolver] Failed for ${sourceUrl}:`, error.message);
        reject(new Error(`Stream resolution failed: ${error.message}`));
        return;
      }

      const directUrl = stdout.trim().split('\n')[0];
      if (!directUrl || !directUrl.startsWith('http')) {
        reject(new Error('No valid URL returned from yt-dlp'));
        return;
      }

      // Determine format from URL or use generic label
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
