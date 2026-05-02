#!/bin/bash
# Pads/resizes assets/icon.png into a square build/icon.png that
# electron-builder can ingest cleanly. Requires ImageMagick (`magick` or
# legacy `convert`).
#
# electron-builder will derive the platform-specific icons (.icns, .ico,
# multi-size PNG sets) from this single 512x512 source.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$PROJECT_DIR/assets/icon.png"
OUT_DIR="$PROJECT_DIR/build"
OUT="$OUT_DIR/icon.png"

if [ ! -f "$SRC" ]; then
  echo "build-icons: source icon not found at $SRC" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

if command -v magick >/dev/null 2>&1; then
  IM=magick
elif command -v convert >/dev/null 2>&1; then
  IM=convert
else
  if [ -f "$OUT" ]; then
    echo "build-icons: ImageMagick not found; using committed $OUT."
    exit 0
  fi
  echo "build-icons: ImageMagick not found (need 'magick' or 'convert')." >&2
  echo "  apt: sudo apt install imagemagick" >&2
  echo "  mac: brew install imagemagick" >&2
  echo "  win: choco install imagemagick" >&2
  exit 1
fi

# Resize-fit to 512x512 box, then center-pad with transparency to a square.
"$IM" "$SRC" \
  -resize 512x512 \
  -gravity center \
  -background none \
  -extent 512x512 \
  "$OUT"

echo "build-icons: wrote $OUT"
