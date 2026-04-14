#!/bin/bash
# Download 4-second preview clips for all 8 videos using yt-dlp + ffmpeg

FFMPEG="C:/Users/Bazuka/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe"
YTDLP="C:/Users/Bazuka/AppData/Roaming/Python/Python314/Scripts/yt-dlp.exe"

CLIPS_DIR="assets/clips"
THUMB_DIR="assets/thumbnails"
TEMP_DIR="temp_downloads"

mkdir -p "$CLIPS_DIR" "$THUMB_DIR" "$TEMP_DIR"

download_clip() {
  local ID="$1"
  local URL="$2"
  local START="$3"
  local TEMP_NAME="$4"

  echo ""
  echo "========== $ID =========="
  echo "URL: $URL | start: ${START}s"

  TEMP_FILE="$TEMP_DIR/$TEMP_NAME"

  # Download best video up to 1080p
  echo "  Downloading..."
  "$YTDLP" -f "bestvideo[height<=1080][ext=mp4]/bestvideo[height<=1080]/best[height<=1080]" \
    "$URL" -o "$TEMP_FILE" --no-playlist --quiet --no-warnings 2>&1

  if [ ! -f "$TEMP_FILE" ]; then
    # yt-dlp might append an extension
    TEMP_FILE=$(ls "$TEMP_DIR/$TEMP_NAME"* 2>/dev/null | head -1)
  fi

  if [ -z "$TEMP_FILE" ] || [ ! -f "$TEMP_FILE" ]; then
    echo "  ERROR: Download failed for $ID"
    return 1
  fi

  echo "  Downloaded: $(du -h "$TEMP_FILE" | cut -f1)"

  # Extract 4-second clip, strip audio, re-encode to H.264
  echo "  Extracting 4s clip (start=${START}s)..."
  "$FFMPEG" -y -i "$TEMP_FILE" -ss "$START" -t 4 -an -c:v libx264 -preset fast \
    -crf 18 -pix_fmt yuv420p "$CLIPS_DIR/${ID}.mp4" 2>/dev/null

  if [ -f "$CLIPS_DIR/${ID}.mp4" ]; then
    echo "  Clip: $(du -h "$CLIPS_DIR/${ID}.mp4" | cut -f1)"
  else
    echo "  ERROR: ffmpeg clip extraction failed for $ID"
    return 1
  fi

  # Extract thumbnail at 2s into the clip (middle frame)
  echo "  Extracting thumbnail..."
  "$FFMPEG" -y -i "$CLIPS_DIR/${ID}.mp4" -ss 2 -vframes 1 \
    -vf "crop=min(iw\,ih):min(iw\,ih),scale=400:400" \
    -q:v 2 "$THUMB_DIR/${ID}.jpg" 2>/dev/null

  if [ -f "$THUMB_DIR/${ID}.jpg" ]; then
    echo "  Thumb: $(du -h "$THUMB_DIR/${ID}.jpg" | cut -f1)"
  else
    echo "  WARNING: thumbnail extraction failed, keeping existing"
  fi

  # Clean up temp download
  rm -f "$TEMP_FILE"

  echo "  DONE"
  return 0
}

echo "Downloading 4-second preview clips..."
echo "yt-dlp: $("$YTDLP" --version)"
echo "ffmpeg: $("$FFMPEG" -version 2>&1 | head -1)"

download_clip "minecraft-parkour-01"  "https://www.youtube.com/watch?v=u7kdVe8q5zs"  0  "temp_minecraft.mp4"
download_clip "subway-surfers-01"     "https://www.youtube.com/watch?v=RNaEo6Zooww"  0  "temp_subway.mp4"
download_clip "gta-chaos-01"          "https://www.youtube.com/watch?v=weAUrmRLpnk"  0  "temp_gta.mp4"
download_clip "satisfying-slime-01"   "https://www.youtube.com/watch?v=lcPTDc9vHkE"  0  "temp_slime.mp4"
download_clip "nature-timelapse-01"   "https://www.youtube.com/watch?v=DbpodPjq68s"  0  "temp_nature.mp4"
download_clip "geometry-dash-01"      "https://www.youtube.com/watch?v=XkyPlrqWumg"  10 "temp_geometry.mp4"
download_clip "cooking-asmr-01"       "https://www.youtube.com/watch?v=594j3Mk4gRQ"  0  "temp_cooking.mp4"
download_clip "abstract-art-01"       "https://www.youtube.com/watch?v=wjQq0nSGS28"  0  "temp_abstract.mp4"

# Cleanup temp dir
rm -rf "$TEMP_DIR"

echo ""
echo "========== SUMMARY =========="
echo "Clips:"
ls -lh "$CLIPS_DIR"/*.mp4 2>/dev/null
echo ""
echo "Thumbnails:"
ls -lh "$THUMB_DIR"/*.jpg 2>/dev/null
