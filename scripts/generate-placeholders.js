/**
 * generate-placeholders.js
 *
 * Generates placeholder thumbnail images for the BrainRot video library.
 * These are simple gradient images with text labels.
 *
 * For real videos: place your .mp4 files in assets/clips/ and .jpg thumbnails
 * in assets/thumbnails/ matching the filenames in the video library config.
 *
 * To add real videos, use yt-dlp:
 *   yt-dlp -f "bestvideo[height<=720]" --merge-output-format mp4 -o "assets/clips/%(id)s.mp4" <URL>
 *   ffmpeg -i assets/clips/video.mp4 -an -c:v copy assets/clips/video-noaudio.mp4
 *
 * Run: node scripts/generate-placeholders.js
 */

const fs = require('fs');
const path = require('path');

const VIDEOS = [
  { id: 'minecraft-parkour-01', title: 'Minecraft\nParkour', start: '#1b5e20', end: '#4CAF50' },
  { id: 'subway-surfers-01', title: 'Subway\nSurfers', start: '#e65100', end: '#FF9800' },
  { id: 'satisfying-slime-01', title: 'Satisfying\nSlime', start: '#880e4f', end: '#E91E63' },
  { id: 'gta-chaos-01', title: 'GTA\nChaos', start: '#b71c1c', end: '#F44336' },
  { id: 'geometry-dash-01', title: 'Geometry\nDash', start: '#0d47a1', end: '#2196F3' },
  { id: 'cooking-asmr-01', title: 'Cooking\nASMR', start: '#bf360c', end: '#FF5722' },
  { id: 'nature-timelapse-01', title: 'Nature\nTimelapse', start: '#004d40', end: '#009688' },
  { id: 'abstract-art-01', title: 'Abstract\nFlow', start: '#4a148c', end: '#9C27B0' },
];

const thumbnailsDir = path.join(__dirname, '..', 'assets', 'thumbnails');
const clipsDir = path.join(__dirname, '..', 'assets', 'clips');

// Ensure directories exist
fs.mkdirSync(thumbnailsDir, { recursive: true });
fs.mkdirSync(clipsDir, { recursive: true });

// Generate SVG placeholder thumbnails (browsers can display these as images)
for (const video of VIDEOS) {
  const lines = video.title.split('\n');
  const textElements = lines.map((line, i) => {
    const y = 200 + (i - (lines.length - 1) / 2) * 40;
    return `<text x="200" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle" filter="url(#shadow)">${line}</text>`;
  }).join('\n    ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${video.start}"/>
      <stop offset="100%" style="stop-color:${video.end}"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.5"/>
    </filter>
  </defs>
  <rect width="400" height="400" rx="16" fill="url(#bg)"/>
  <circle cx="200" cy="140" r="40" fill="rgba(255,255,255,0.15)"/>
  <polygon points="188,120 188,160 220,140" fill="white" opacity="0.8"/>
  ${textElements}
</svg>`;

  // Save as SVG (will be loaded as image — Electron handles SVG fine)
  const svgPath = path.join(thumbnailsDir, `${video.id}.svg`);
  fs.writeFileSync(svgPath, svg);

  // Also create a .jpg redirect (an SVG file renamed to .jpg won't work,
  // but we'll reference .svg in the app when .jpg is not found)
  console.log(`  Created: thumbnails/${video.id}.svg`);
}

console.log(`\nGenerated ${VIDEOS.length} placeholder thumbnails in assets/thumbnails/`);
console.log(`\nTo add real videos:`);
console.log(`  1. Place .mp4 files in assets/clips/ (named to match config)`);
console.log(`  2. Place .jpg thumbnails (400x400) in assets/thumbnails/`);
console.log(`  3. Strip audio: ffmpeg -i input.mp4 -an -c:v copy output.mp4`);
