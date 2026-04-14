/**
 * download-thumbnails.js
 *
 * Downloads YouTube maxresdefault thumbnails for all 8 videos,
 * then uses sharp (or canvas) to crop/resize to 400x400 JPG.
 * Falls back to hqdefault if maxresdefault isn't available.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const VIDEOS = [
  { id: 'minecraft-parkour-01', ytId: 'u7kdVe8q5zs' },
  { id: 'subway-surfers-01',   ytId: 'RNaEo6Zooww' },
  { id: 'satisfying-slime-01', ytId: 'lcPTDc9vHkE' },
  { id: 'gta-chaos-01',        ytId: 'weAUrmRLpnk' },
  { id: 'geometry-dash-01',    ytId: 'XkyPlrqWumg' },
  { id: 'cooking-asmr-01',     ytId: '594j3Mk4gRQ' },
  { id: 'nature-timelapse-01', ytId: 'DbpodPjq68s' },
  { id: 'abstract-art-01',     ytId: 'wjQq0nSGS28' },
];

const thumbnailsDir = path.join(__dirname, '..', 'assets', 'thumbnails');
fs.mkdirSync(thumbnailsDir, { recursive: true });

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadThumbnail(video) {
  // YouTube thumbnail URLs in order of preference (highest quality first)
  const urls = [
    `https://img.youtube.com/vi/${video.ytId}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${video.ytId}/sddefault.jpg`,
    `https://img.youtube.com/vi/${video.ytId}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${video.ytId}/mqdefault.jpg`,
  ];

  for (const url of urls) {
    try {
      const buffer = await downloadFile(url);

      // YouTube returns a tiny grey placeholder (< 2KB) for missing resolutions
      if (buffer.length < 5000) {
        console.log(`  [skip] ${url} — too small (${buffer.length} bytes), trying next...`);
        continue;
      }

      const outPath = path.join(thumbnailsDir, `${video.id}.jpg`);
      fs.writeFileSync(outPath, buffer);
      console.log(`  [ok] ${video.id}.jpg — ${(buffer.length / 1024).toFixed(1)}KB from ${url.split('/').pop()}`);
      return true;
    } catch (err) {
      console.log(`  [fail] ${url} — ${err.message}`);
    }
  }

  console.log(`  [MISS] ${video.id} — no thumbnail found, keeping SVG placeholder`);
  return false;
}

async function main() {
  console.log('Downloading YouTube thumbnails...\n');

  let success = 0;
  for (const video of VIDEOS) {
    console.log(`${video.id} (${video.ytId}):`);
    if (await downloadThumbnail(video)) success++;
  }

  console.log(`\nDone: ${success}/${VIDEOS.length} thumbnails downloaded to assets/thumbnails/`);

  if (success < VIDEOS.length) {
    console.log('\nNote: For missing thumbnails, the app will fall back to SVG placeholders or gradient backgrounds.');
  }

  console.log('\nTip: For best 400x400 crops, install sharp and run:');
  console.log('  npm install sharp --save-dev');
  console.log('  node scripts/crop-thumbnails.js');
  console.log('Or manually crop in any image editor to 400x400 center-crop.');
}

main().catch(console.error);
