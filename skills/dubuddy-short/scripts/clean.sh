#!/usr/bin/env bash
# "clean" (user rule, 2026-10-07): keep ONLY the rendered videos; everything else for the clip goes to the Trash —
# edit files, previews, mattes, cut.mp4, cached transcript AND the original source footage.
#   bash clean.sh <edit_dir> [--dry-run]
# Rendered files stay at <edit_dir>/output/youtube/final_yt.mp4 + output/instagram/final_ig.mp4 (DropShelf points there).
set -euo pipefail
ED="$(cd "$1" && pwd)"; DRY="${2:-}"
KEEP=$(find "$ED/output" -type f -name 'final_*.mp4' 2>/dev/null)
[ -n "$KEEP" ] || { echo "no rendered final_*.mp4 in $ED/output — refusing to clean"; exit 1; }
SRC=$(python3 -c "import json;print(json.load(open('$ED/plan.json')).get('source',''))" 2>/dev/null || true)
STEM=$(basename "$ED")
L=()
for p in "$ED"/* "$ED"/.[!.]*; do [ -e "$p" ] && [ "$p" != "$ED/output" ] && [ "${p##*/}" != .DS_Store ] && L+=("$p"); done
for p in "$ED"/output/*; do [ -d "$p" ] || L+=("$p"); done                       # loose output files (plan/transcript/srt…)
for p in "$ED"/output/*/*; do echo "$KEEP" | grep -qxF "$p" || L+=("$p"); done
[ -n "$SRC" ] && [ -f "$SRC" ] && L+=("$SRC")                                     # the original footage
for t in "$(dirname "$ED")/transcripts/$STEM".*; do [ -e "$t" ] && L+=("$t"); done
[ ${#L[@]} -gt 0 ] || { echo "already clean — only the rendered videos are here"; exit 0; }
printf 'trash: %s\n' "${L[@]}"; echo "$KEEP" | sed 's/^/keep:  /'
[ "$DRY" = "--dry-run" ] && exit 0
trash "${L[@]}"; echo "cleaned — only the rendered videos remain (empty the Trash to free the space)"
