#!/usr/bin/env bash
# 🎬 HyperFrames Studio for one Claude edit, on your Mac.
# The card's "Open in Studio" button gives you the one line that runs this:
#   bash <(curl -fsSL https://tools.dubuddy.in/studio/dubuddy-studio.sh) <card> <get-link> <put-link> <done-link>
# 1. downloads the card's edit folder  2. opens the YouTube + Instagram versions in Studio
# 3. when you press Return, sends the edited folder back so Approve renders exactly what Studio shows.
set -euo pipefail
CARD="${1:?card id missing — copy the whole line from the card}"; GET="${2:?}"; PUT="${3:?}"; DONE="${4:?}"
HF_VER="0.8.34"
DIR="$HOME/DubuddyStudio/$CARD"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

command -v npx >/dev/null || { echo "Node.js is needed for Studio: install it from https://nodejs.org and run the line again."; exit 1; }

say "⬇️  Downloading the edit…"
rm -rf "$DIR"; mkdir -p "$DIR"
curl -fL --progress-bar "$GET" -o "$DIR/edit.tar.gz"
tar -xzf "$DIR/edit.tar.gz" -C "$DIR" && rm "$DIR/edit.tar.gz"
ED="$DIR/edit/raw"
[ -d "$ED" ] || { echo "The download has no edit folder in it."; exit 1; }

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT
open_studio() {   # <hf folder> <port> <name>
  [ -d "$ED/$1" ] || return 0
  (cd "$ED/$1" && exec npx --yes "hyperframes@$HF_VER" preview --port "$2" --no-open --foreground --force-new) >"$DIR/studio-$1.log" 2>&1 &
  PIDS+=("$!")
  for _ in $(seq 1 90); do curl -s -o /dev/null "http://localhost:$2" && break; sleep 1; done
  open "http://localhost:$2" 2>/dev/null || true
  echo "   $3 → http://localhost:$2"
}
say "🎬 Starting Studio (the first time takes a minute)…"
open_studio hf_yt 3013 "YouTube"
open_studio hf_ig 3014 "Instagram"
[ -d "$ED/hf_yt" ] || [ -d "$ED/hf_ig" ] || open_studio hf 3012 "Edit"

say "Edit in Studio — it saves by itself."
printf 'When you are done, press Return here to send your changes (or type q and Return to quit without sending): '
read -r ans || ans=q
cleanup; PIDS=()
if [ "$ans" = "q" ]; then echo "Nothing sent. Your copy stays in $DIR"; exit 0; fi

say "⬆️  Sending your changes…"
touch "$ED/STUDIO_EDITS"
(cd "$DIR" && tar -czf "$DIR/edit-out.tar.gz" --exclude node_modules --exclude renders --exclude .cache --exclude studio_backups edit)
curl -fS --progress-bar -X PUT -T "$DIR/edit-out.tar.gz" "$PUT" -o /dev/null
curl -fsS -X POST -H 'content-type: application/json' -d '{}' "$DONE" -o /dev/null \
  || { echo "Uploaded, but the website didn't confirm. Refresh the card — if it still shows no '✅ Your Studio edits arrived', run the line again."; exit 1; }
rm -f "$DIR/edit-out.tar.gz"
say "✅ Sent. Back on the card, press \"Approve — render it\"."
