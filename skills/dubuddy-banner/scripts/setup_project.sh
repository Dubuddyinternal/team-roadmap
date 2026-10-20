#!/usr/bin/env bash
# Sets up a DuBuddy banner project folder (once per campaign).
# usage: bash setup_project.sh <project-dir> [--player]
#   --player  also downloads the official Lottie player (diffusionstudio/lottie) for live browser preview
set -euo pipefail
SK="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?usage: setup_project.sh <project-dir> [--player]}"
mkdir -p "$DIR/fonts" "$DIR/out"
cp "$SK"/scripts/lottie_kit.py "$SK"/scripts/text_to_paths.cjs "$SK"/scripts/render_frames.cjs \
   "$SK"/scripts/export_light.py "$SK"/scripts/check_banner.py "$SK"/scripts/sheet.py "$SK"/scripts/trace_logo.py "$DIR"/
cp "$SK"/assets/fonts/*.ttf "$DIR/fonts/"
cp "$SK"/assets/dubuddy_mark.json "$DIR/"
[ -f "$DIR/build_banner.py" ] || cp "$SK"/template/build_banner.py "$DIR/build_banner.py"
cd "$DIR"
[ -f package.json ] || npm init -y >/dev/null
npm install --silent opentype.js@1.3.4 canvaskit-wasm@0.41.1 >/dev/null
if [ "${2:-}" = "--player" ] && [ ! -d lottie-player ]; then
  npx -y degit diffusionstudio/lottie lottie-player >/dev/null 2>&1
  (cd lottie-player && npm install --silent >/dev/null)
fi
echo "ready: $DIR  (edit CAMPAIGN in build_banner.py, then: python3 build_banner.py)"
