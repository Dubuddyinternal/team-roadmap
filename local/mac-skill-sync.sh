#!/usr/bin/env bash
# =====================================================================
# ONE-TIME MAC SETUP: the dubuddy-short skill on this Mac follows GitHub main.
#
#   bash local/mac-skill-sync.sh        (from the dubuddy-tools-site folder; safe to run again)
#
# What it does:
#   1. Keeps a small copy of just the skills folder of the GitHub repo in ~/.agents/dubuddy-skill-repo
#   2. Points ~/.agents/skills/dubuddy-short (and ~/.claude/skills/dubuddy-short) at it.
#      Your old copy is moved to ~/.agents/skills/dubuddy-short.backup-<date>, not deleted.
#   3. Adds a Claude Code start hook: every time Claude Code starts it pulls the latest skill.
# After this, a rule saved with "remember this" (from a card or here) is on this Mac at the next Claude Code start,
# and "remember this" said here pushes to GitHub too (the skill's scripts/remember.py).
# =====================================================================
set -euo pipefail
REPO_URL="${DUBUDDY_REPO_URL:-https://github.com/sumitkumarimages777-stack/team-roadmap.git}"
CLONE="$HOME/.agents/dubuddy-skill-repo"
SKILL="$HOME/.agents/skills/dubuddy-short"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [ -d "$CLONE/.git" ]; then
  echo "↻ Updating $CLONE"
  git -C "$CLONE" pull -q --ff-only origin main
else
  echo "⬇ Getting the skill from GitHub (just the skills folder)"
  if ! git clone -q --filter=blob:none --sparse --branch main "$REPO_URL" "$CLONE"; then
    echo "✗ Couldn't reach the repository. Sign in to GitHub on this Mac first (e.g. 'gh auth login'), then run this again."; exit 1
  fi
  git -C "$CLONE" sparse-checkout set skills
fi

mkdir -p "$HOME/.agents/skills" "$HOME/.claude/skills"
for link in "$SKILL" "$HOME/.claude/skills/dubuddy-short"; do
  if [ -e "$link" ] && [ ! -L "$link" ]; then
    mv "$link" "$link.backup-$STAMP"; echo "📦 Your old copy is kept at $link.backup-$STAMP"
  fi
done
ln -sfn "$CLONE/skills/dubuddy-short" "$SKILL"
ln -sfn "$SKILL" "$HOME/.claude/skills/dubuddy-short"
echo "🔗 $SKILL → GitHub main"

# Claude Code start hook: pull the latest skill (quietly; never blocks Claude if offline)
python3 - "$CLONE" <<'PY'
import json, os, sys
clone = sys.argv[1]
path = os.path.expanduser("~/.claude/settings.json")
try:
    with open(path) as f: s = json.load(f)
except FileNotFoundError: s = {}
cmd = f'git -C "{clone}" pull -q --ff-only origin main >/dev/null 2>&1 || true'
groups = s.setdefault("hooks", {}).setdefault("SessionStart", [])
if not any(h.get("command") == cmd for g in groups for h in g.get("hooks", [])):
    groups.append({"hooks": [{"type": "command", "command": cmd, "timeout": 20}]})
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path): os.replace(path, path + ".backup")
    with open(path, "w") as f: json.dump(s, f, indent=2)
    print("🪝 Claude Code now pulls the latest skill every time it starts (~/.claude/settings.json; old one saved as settings.json.backup)")
else:
    print("🪝 The start hook was already there")
PY
echo "✅ Done. Rules saved with “remember this” live in the 'Your rules' section at the end of $SKILL/SKILL.md"
