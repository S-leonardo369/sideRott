#!/bin/bash
# Fast download of 4-second preview clips using yt-dlp --download-sections

FFMPEG="C:/Users/Bazuka/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe"
YTDLP="C:/Users/Bazuka/AppData/Roaming/Python/Python314/Scripts/yt-dlp.exe"

CLIPS_DIR="assets/clips"
THUMB_DIR="assets/thumbnails"

mkdir -p "$CLIPS_DIR" "$THUMB_DIR"

download_clip() {
  local ID="$1"
  local URL="$2"
  local START="$3"
  local END=$(( START + 6 ))  # grab 6s so ffmpeg has room for keyframe alignment

  echo ""
  echo "--- $ID (start=${START}s) ---"

  local TEMP="temp_${ID}.mp4"

  # Download only the needed section at 480p (format 135 = 480p mp4 avc1)
  "$YTDLP" -f "135/134/18/best[height<=720]" \
    --download-sections "*${START}-${END}" \
    --force-keyframes-at-cuts \
    --ffmpeg-location "$FFMPEG" \
    "$URL" -o "$TEMP" --no-playlist --quiet 2>&1

  if [ ! -f "$TEMP" ]; then
    echo "  DOWNLOAD FAILED — trying alternate format"
    "$YTDLP" -f "best[height<=720]" \
      --download-sections "*${START}-${END}" \
      --force-keyframes-at-cuts \
      --ffmpeg-location "$FFMPEG" \
      "$URL" -o "$TEMP" --no-playlist --quiet 2>&1
  fi

  if [ ! -f "$TEMP" ]; then
    echo "  FAILED completely for $ID"
    return 1
  fi

  # Cut to exactly 4s, strip audio, re-encode H.264
  "$FFMPEG" -y -i "$TEMP" -ss 0 -t 4 -an -c:v libx264 -preset fast \
    -crf 18 -pix_fmt yuv420p "$CLIPS_DIR/${ID}.mp4" 2>/dev/null

  # Extract thumbnail at 2s mark
  "$FFMPEG" -y -i "$CLIPS_DIR/${ID}.mp4" -ss 2 -vframes 1 \
    -vf "crop=min(iw\,ih):min(iw\,ih),scale=400:400" \
    -q:v 2 "$THUMB_DIR/${ID}.jpg" 2>/dev/null

  rm -f "$TEMP"

  if [ -f "$CLIPS_DIR/${ID}.mp4" ]; then
    local SIZE=$(du -h "$CLIPS_DIR/${ID}.mp4" | cut -f1)
    echo "  OK: clip=$SIZE"
  else
    echo "  CLIP FAILED"
    return 1
  fi

  if [ -f "$THUMB_DIR/${ID}.jpg" ]; then
    echo "  OK: thumbnail generated"
  fi
}

echo "Downloading 4-second preview clips (fast mode)..."

# Note: minecraft-parkour-01 already downloaded above — skip if exists
if [ -f "$CLIPS_DIR/minecraft-parkour-01.mp4" ]; then
  echo "--- minecraft-parkour-01 --- ALREADY EXISTS, skipping"
else
  download_clip "minecraft-parkour-01"  "https://www.youtube.com/watch?v=u7kdVe8q5zs"  0
fi

download_clip "subway-surfers-01"     "https://www.youtube.com/watch?v=RNaEo6Zooww"  0
download_clip "gta-chaos-01"          "https://www.youtube.com/watch?v=weAUrmRLpnk"  0
download_clip "satisfying-slime-01"   "https://www.youtube.com/watch?v=lcPTDc9vHkE"  0
download_clip "nature-timelapse-01"   "https://www.youtube.com/watch?v=DbpodPjq68s"  0
download_clip "geometry-dash-01"      "https://www.youtube.com/watch?v=XkyPlrqWumg"  10
download_clip "cooking-asmr-01"       "https://www.youtube.com/watch?v=594j3Mk4gRQ"  0
download_clip "abstract-art-01"       "https://www.youtube.com/watch?v=wjQq0nSGS28"  0

echo ""
echo "========== RESULTS =========="
echo "Clips:"
ls -lh "$CLIPS_DIR"/*.mp4 2>/dev/null || echo "  (none)"
echo ""
echo "Thumbnails:"
ls -lh "$THUMB_DIR"/*.jpg 2>/dev/null || echo "  (none)"
