#!/usr/bin/env bash
# Pull the latest dubuddy-short skill from GitHub main (run at the start of every use of the skill).
# Never fails the edit: offline / dirty checkout just prints a note. Prints the current skill commit.
D="$(cd "$(dirname "$0")/.." && pwd -P)"
R="$(git -C "$D" rev-parse --show-toplevel 2>/dev/null)" || { echo "sync: not a git checkout, using local copy"; exit 0; }
if git -C "$R" pull -q --ff-only origin main 2>/dev/null; then
  echo "sync: skill is up to date — $(git -C "$R" log --oneline -1 -- "$D")"
else
  echo "sync: could not pull (offline or local changes) — using local copy: $(git -C "$R" log --oneline -1 -- "$D")"
fi
