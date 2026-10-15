#!/usr/bin/env bash
# Paste THIS into claude.ai → Environment (dubuddy-pipeline) → Setup script.
# It only finds the team-roadmap checkout and runs routine/setup.sh from it, so later fixes to the
# setup come from the repo and nothing needs pasting again.
set -euo pipefail
REPO=""
for d in "$PWD" /home/user/team-roadmap "$HOME/team-roadmap" /workspace/team-roadmap; do
  if [ -f "$d/routine/setup.sh" ]; then REPO="$d"; break; fi
done
if [ -z "$REPO" ]; then
  f="$(find / -path /proc -prune -o -path '*/routine/setup.sh' -print 2>/dev/null | head -1)"
  [ -n "$f" ] && REPO="$(dirname "$(dirname "$f")")"
fi
if [ -z "$REPO" ]; then echo "team-roadmap checkout not found"; exit 1; fi
bash "$REPO/routine/setup.sh"
