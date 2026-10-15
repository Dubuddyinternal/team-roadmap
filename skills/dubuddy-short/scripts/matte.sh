#!/usr/bin/env bash
# Speaker cut-out for "graphic behind the head" moments, colour-matched to cut.mp4.
# usage: matte.sh <ED> <start_sec> <dur_sec>   → <ED>/matte/fg_<start>.webm ; add to plan.mattes=[{file,start,dur}]
# Takes ONLY the alpha from the AI matte; RGB comes straight from cut.mp4 and is tagged bt709 (untagged VP9 = visible colour shift).
set -euo pipefail
ED="$1"; ST="$2"; DU="$3"; M="$ED/matte"; mkdir -p "$M"
ffmpeg -loglevel error -y -ss "$ST" -t "$DU" -i "$ED/cut.mp4" -an -c:v libx264 -crf 12 -pix_fmt yuv420p "$M/seg_$ST.mp4"
(cd "$ED" && npx hyperframes remove-background "matte/seg_$ST.mp4" -o "matte/raw_$ST.webm" --quality best >/dev/null 2>&1)
ffmpeg -loglevel error -y -ss "$ST" -t "$DU" -i "$ED/cut.mp4" -c:v libvpx-vp9 -i "$M/raw_$ST.webm" \
  -filter_complex "[1:v]alphaextract[a];[0:v][a]alphamerge,format=yuva420p[v]" -map "[v]" -an \
  -c:v libvpx-vp9 -pix_fmt yuva420p -crf 16 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -auto-alt-ref 0 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv "$M/fg_$ST.webm"
echo "$M/fg_$ST.webm  →  plan.mattes: {\"file\": \"matte/fg_$ST.webm\", \"start\": $ST, \"dur\": $DU}"
