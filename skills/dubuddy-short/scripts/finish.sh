#!/usr/bin/env bash
# Stage 3 — render ONLY after the user approved the brief.
#   bash ~/.agents/skills/dubuddy-short/scripts/finish.sh <edit_dir>
# → <edit_dir>/final.mp4 (H.264 1080x1920 @ source fps, AAC 48k, -14 LUFS) → qc.py → <edit_dir>/output/
#   bash finish.sh <edit_dir> [yt|ig]  — no variant + hf_yt/ & hf_ig/ present → renders BOTH (YouTube, then Instagram)
set -euo pipefail
ED="$(cd "$1" && pwd)"
V="${2:-}"
if [ -z "$V" ] && [ -d "$ED/hf_yt" ] && [ -d "$ED/hf_ig" ]; then
  echo "== YouTube =="; bash "$0" "$ED" yt
  echo "== Instagram =="; bash "$0" "$ED" ig
  # hand both finished videos to DropShelf (menu-bar shelf; items persist across restarts)
  OUT=("$ED/output/youtube/final_yt.mp4" "$ED/output/instagram/final_ig.mp4")
  [ -f "${OUT[0]}" ] || OUT=("$ED/final_yt.mp4" "$ED/final_ig.mp4")
  if [ -d /Applications/DropShelf.app ]; then open -a DropShelf "${OUT[@]}" && echo "sent to DropShelf: ${OUT[*]##*/}"; else echo "DropShelf not installed — skipped"; fi
  exit 0
fi
SUF="${V:+_$V}"
HF="$ED/hf$SUF"
RAW="$HF/renders/master.mp4"
FINAL="$ED/final$SUF.mp4"
QC="$ED/qc$SUF"
mkdir -p "$QC"

cd "$HF"
FPS=$(python3 -c "import json;print(json.load(open('$ED/timeline.json'))['fps'])")
# full render log → qc/render.log (kept out of the chat); show its tail only on failure
# reuse a master already rendered from this exact index.html (e.g. after a failed post-step)
if [ -f "$RAW" ] && [ "$RAW" -nt index.html ] && [ "${FORCE_RENDER:-0}" != 1 ]; then
  echo "reusing $RAW (newer than index.html; FORCE_RENDER=1 to redo)"
else
  # Heavy compositions (full-screen SVG filters + alpha video) hang Chrome at random frames on this 8 GB Mac.
  # Segmented capture: 150-frame segments, fresh browser per segment, 90 s hang timeout; each retry --resume's
  # the finished segments, so a hang costs one 5 s chunk instead of the whole render. Close Studio previews first.
  : > "$QC/render.log"; ok=0
  for a in $(seq 1 20); do
    echo "=== attempt $a" >> "$QC/render.log"
    if HF_SEGMENTED_CAPTURE=true HF_SEGMENT_FRAMES=150 HF_SEGMENT_BROWSER_RECYCLE=1 HF_SEGMENTED_MIN_SECONDS=0 \
       npx --yes hyperframes@0.8.111 render --quality high --fps "$FPS" --no-low-memory-mode --workers 2 \
       --protocol-timeout 90000 --resume -o "$RAW" >> "$QC/render.log" 2>&1; then ok=1; break; fi
    pkill -f chrome-headless-shell || true; sleep 2
  done
  [ $ok = 1 ] || { tail -40 "$QC/render.log"; echo "RENDER FAILED after 20 attempts — full log: $QC/render.log"; exit 1; }
fi
echo "rendered: $(grep -o 'rendered in [^·]*' "$QC/render.log" | tail -1)"

# two-pass loudnorm to -14 LUFS
M=$(ffmpeg -hide_banner -i "$RAW" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$M" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i "$RAW" -c:v copy \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart "$FINAL"

# QC frames: 6 evenly spaced
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$FINAL")
for k in 1 2 3 4 5 6; do
  T=$(python3 -c "print(round($D*($k-0.5)/6,2))")
  ffmpeg -v error -y -ss "$T" -i "$FINAL" -frames:v 1 -vf scale=240:-2 "$QC/f$k.jpg"
done
ffmpeg -v error -y -i "$QC/f%d.jpg" -vf tile=6x1 "$QC/sheet.jpg"
python3 "$(dirname "$0")/qc.py" "$ED" $V
