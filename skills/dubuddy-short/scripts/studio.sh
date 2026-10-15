#!/usr/bin/env bash
# HyperFrames Studio (live motion preview, no render) for the clip whose brief was built last.
# brief.py records that clip in ~/.agents/skills/dubuddy-short/.current
ED="${1:-$(cat "$(dirname "$0")/../.current")}"
cd "$ED/${HF:-hf}" || { echo "no ${HF:-hf} project in $ED"; exit 1; }   # HF=hf_yt|hf_ig for a platform variant
exec npx --yes hyperframes@0.8.34 preview --port "${PORT:-3012}" --no-open --foreground --force-new
