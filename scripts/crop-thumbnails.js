/**
 * crop-thumbnails.js
 *
 * Center-crops all downloaded YouTube thumbnails to 400x400 JPG.
 * YouTube thumbnails are 16:9 (1280x720 for maxresdefault), so we take
 * the center square crop and resize to 400x400.
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const thumbnailsDir = path.join(__dirname, '..', 'assets', 'thumbnails');

const VIDEOS = [
  'minecraft-parkour-01',
  'subway-surfers-01',
  'satisfying-slime-01',
  'gta-chaos-01',
  'geometry-dash-01',
  'cooking-asmr-01',
  'nature-timelapse-01',
  'abstract-art-01',
];

async function cropThumbnail(id) {
  const inputPath = path.join(thumbnailsDir, `${id}.jpg`);
  const tempPath = path.join(thumbnailsDir, `${id}_cropped.jpg`);

  if (!fs.existsSync(inputPath)) {
    console.log(`  [skip] ${id}.jpg not found`);
    return false;
  }

  try {
    const metadata = await sharp(inputPath).metadata();
    const { width, height } = metadata;

    // Center-crop to square (use the smaller dimension)
    const size = Math.min(width, height);
    const left = Math.round((width - size) / 2);
    const top = Math.round((height - size) / 2);

    await sharp(inputPath)
      .extract({ left, top, width: size, height: size })
      .resize(400, 400, { fit: 'cover', kernel: 'lanczos3' })
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(tempPath);

    // Replace original with cropped version
    fs.unlinkSync(inputPath);
    fs.renameSync(tempPath, inputPath);

    const finalSize = fs.statSync(inputPath).size;
    console.log(`  [ok] ${id}.jpg — ${width}x${height} → 400x400 (${(finalSize / 1024).toFixed(1)}KB)`);
    return true;
  } catch (err) {
    console.log(`  [fail] ${id}.jpg — ${err.message}`);
    // Clean up temp file if it exists
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return false;
  }
}

async function main() {
  console.log('Cropping thumbnails to 400x400...\n');

  let success = 0;
  for (const id of VIDEOS) {
    if (await cropThumbnail(id)) success++;
  }

  console.log(`\nDone: ${success}/${VIDEOS.length} thumbnails cropped.`);
}

main().catch(console.error);
