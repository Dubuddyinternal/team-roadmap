#!/usr/bin/env bash
# DRAFT, to be confirmed by the first cloud test run.
# Setup script for the routine's cloud environment (claude.ai → Environment → Setup script).
# It runs as root on Ubuntu 24.04 when a session starts; the result is cached if it finishes in about 5 minutes.
# Expected repo layout:  routine/  skills/dubuddy-short/  video-use/  sfx/  (the SFX library the skill uses)
set -euo pipefail
# the repo is the folder above this script (the environment's launcher runs it from wherever the repo was cloned)
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "repo: $REPO"

apt-get update -qq
apt-get install -y -qq ffmpeg fonts-noto fonts-noto-color-emoji fonts-noto-core >/dev/null

command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# put the skill and video-use where the skill's own commands look for them
mkdir -p ~/.agents/skills ~/.claude/skills ~/Developer
ln -sfn "$REPO/skills/dubuddy-short" ~/.agents/skills/dubuddy-short
ln -sfn ~/.agents/skills/dubuddy-short ~/.claude/skills/dubuddy-short
ln -sfn "$REPO/video-use" ~/Developer/video-use
(cd ~/Developer/video-use && uv sync -q)
python3 -m pip install -q --break-system-packages pillow

# warm the HyperFrames versions the skill pins (renderer + its headless browser)
npx --yes hyperframes@0.8.111 --version >/dev/null 2>&1 || true
npx --yes hyperframes@0.8.34 --version >/dev/null 2>&1 || true

# video-use and the skill read their keys from ~/Developer/video-use/.env (never kept in the repo):
# write it from the environment's secrets (claude.ai → Environment → Secrets: ELEVENLABS_API_KEY, PEXELS_API_KEY)
: > "$REPO/video-use/.env"
for k in ELEVENLABS_API_KEY PEXELS_API_KEY; do
  if [ -n "${!k:-}" ]; then echo "$k=${!k}" >> "$REPO/video-use/.env"; else echo "warning: $k is not set in the environment's secrets"; fi
done

# the skill reads the SFX library from this env var when set (sfx/ in the repo)
echo "export DUBUDDY_SFX_DIR=\"$REPO/sfx\"" >> ~/.bashrc
echo "setup done"
