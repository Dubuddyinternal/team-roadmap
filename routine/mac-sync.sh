#!/usr/bin/env bash
# Run ONCE on the Mac. Makes the local dubuddy-short skill a live copy of GitHub main:
#   1. clones team-roadmap to ~/Developer/team-roadmap (or pulls it if already there)
#   2. points ~/.agents/skills/dubuddy-short (and ~/.claude/skills/dubuddy-short) at that clone — the old folder is moved aside, not deleted
#   3. adds a Claude Code SessionStart hook that pulls main every time Claude Code starts
#   4. installs a macOS background job (launchd) that also pulls main at login and every 10 minutes, so the skill is current even before Claude Code starts
set -euo pipefail
REPO_URL="${REPO_URL:-https://github.com/sumitkumarimages777-stack/team-roadmap}"
CLONE="$HOME/Developer/team-roadmap"
SK="$HOME/.agents/skills/dubuddy-short"

mkdir -p "$HOME/Developer" "$HOME/.agents/skills" "$HOME/.claude/skills"
if [ -d "$CLONE/.git" ]; then
  git -C "$CLONE" fetch -q origin main
  git -C "$CLONE" checkout -q main
  git -C "$CLONE" pull -q --ff-only origin main
else
  git clone -q -b main "$REPO_URL" "$CLONE"
fi

if [ -e "$SK" ] && [ ! -L "$SK" ]; then
  mv "$SK" "$SK.old-$(date +%Y%m%d%H%M%S)"
  echo "old skill folder moved aside"
fi
ln -sfn "$CLONE/skills/dubuddy-short" "$SK"
ln -sfn "$SK" "$HOME/.claude/skills/dubuddy-short"

python3 - <<'PY'
import json, os
p = os.path.expanduser("~/.claude/settings.json")
s = json.load(open(p)) if os.path.exists(p) else {}
cmd = "git -C ~/Developer/team-roadmap pull -q --ff-only origin main >/dev/null 2>&1 || true"
hooks = s.setdefault("hooks", {}).setdefault("SessionStart", [])
if not any(h.get("command") == cmd for g in hooks for h in g.get("hooks", [])):
    hooks.append({"hooks": [{"type": "command", "command": cmd}]})
    json.dump(s, open(p, "w"), indent=2)
    print("SessionStart hook added")
else:
    print("SessionStart hook already there")
PY

PLIST="$HOME/Library/LaunchAgents/in.dubuddy.skill-sync.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>in.dubuddy.skill-sync</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string><string>-c</string>
    <string>git -C "$CLONE" pull -q --ff-only origin main || true</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>600</integer>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST" && echo "background sync installed (every 10 min)"

echo "skill now at: $(git -C "$CLONE" log --oneline -1)"
