# Dubuddy sound effects (for the cloud routine)

The cloud can't reach the OneDrive library, so `skills/dubuddy-short/scripts/sfx_lib.py` takes sounds from here.

- Fill it from the Mac: `python3 ~/.agents/skills/dubuddy-short/scripts/sfx_lib.py ~/Desktop/dubuddy-sfx`,
  then copy the mp3s from `~/Desktop/dubuddy-sfx/sfx/` here (already trimmed, peak -1 dBFS, 48 kHz).
- Add a new sound: drop it here named as you want to call it in a plan (e.g. `whoosh2.mp3`, `cheer.wav`).
  mp3s are used as they are; wav/m4a/aiff are levelled and converted on the fly.
- Same name as a house sound (`pop`, `ding`, …) replaces it.
