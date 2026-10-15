#!/usr/bin/env python3
"""Fill <ED>/sfx/ from the user's OneDrive SFX library (trimmed, faded, peak -1 dBFS, 48 kHz).
build.py copies <ED>/sfx/ over the house set: same names override, new names are usable in broll sfx lists.
No OneDrive (the cloud routine): takes the ready-made sounds from the repo's sfx/ folder instead
($DUBUDDY_SFX_DIR, else team-roadmap/sfx next to skills/). Any extra sound dropped there is usable by its file name.
usage: python3 sfx_lib.py <ED>"""
import os, re, shutil, subprocess, sys
LIB = os.path.expanduser("~/Library/CloudStorage/OneDrive-Personal/Assests/Sound Effects/")
REPO_SFX = os.environ.get("DUBUDDY_SFX_DIR") or os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..", "..", "sfx")
M = [("pop","Pop 1.mp3",.6),("whoosh-short","Editing SFX/swoosh 03.mp3",.67),("whoosh","Whoosh 4.mp3",.9),
 ("click","Editing SFX/click subscribe.mp3",1.0),("chime","Editing SFX/subscribe bell sound.mp3",2.2),("typing","typing-on-laptop-keyboard-308455.mp3",1.3),
 ("boom","Library/Cinematic Boom 1.mp3",2.4),("tick","Editing SFX/Clock Tick.mp3",.45),("flip","page-flip-47177.mp3",.62),
 ("sparkle","Editing SFX/Ting.mp3",1.4),("riser","Editing SFX/Ascending sound effect.mp3",2.2),("drone","Editing SFX/Dark Drop.wav",2.6),
 ("glitch","Editing SFX/Glitch Sound Effect.mp3",.8),("slide","Editing SFX/Paper Slide.wav",1.0),("thud","Editing SFX/Heavy object Hit and body thud sound effect.mp3",.8),
 ("correct","Editing SFX/correct sfx.mp3",1.4),("wrong","Editing SFX/Wrong Answer.mp3",1.16),("count","Editing SFX/Digital counting.mp3",.8),
 ("write","Editing SFX/WRITING Sound Effect 2.mp3",1.2),("pencil","big-pencil-swirls-89282.mp3",2.3),("crumple","crumpling-paper-37773.mp3",.8),
 ("throw","Editing SFX/throwing.mp3",.5),("clank","Editing SFX/Metal Slam.wav",.9),("stamp","Editing SFX/Hit 1.mp3",.9),("ding","Editing SFX/Ding 2.mp3",.55),
 ("swing","Editing SFX/Swing A.wav",1.0),("clockbed","Editing SFX/Clock Tick.mp3",9.5),("flare","Editing SFX/Lens flare transition sound effect.mp3",.86),
 ("bubble","Editing SFX/Pop Bubble Sound Effect.mp3",.6),("cinwhoosh","Library/Cinematic Whoosh.mp3",1.6),("scroll","Editing SFX/Paper Flip Sound Effect.mp3",1.2)]
out = os.path.join(sys.argv[1], "sfx"); os.makedirs(out, exist_ok=True)
if not os.path.isdir(LIB):
    if not os.path.isdir(REPO_SFX): sys.exit(f"no SFX library: neither {LIB} nor {REPO_SFX}")
    n = 0
    for f in sorted(os.listdir(REPO_SFX)):
        name, ext = os.path.splitext(f)
        if ext.lower() == ".mp3": shutil.copy(os.path.join(REPO_SFX, f), f"{out}/{name}.mp3"); n += 1
        elif ext.lower() in (".wav", ".m4a", ".aif", ".aiff"):   # a new sound added as-is: peak -1 dBFS, 48 kHz mp3
            src = os.path.join(REPO_SFX, f)
            mx = float(re.search(r"max_volume: (-?[\d.]+)", subprocess.run(["ffmpeg","-i",src,"-af","volumedetect","-f","null","-"],capture_output=True,text=True).stderr).group(1))
            subprocess.run(["ffmpeg","-v","error","-y","-i",src,"-af",f"volume={-1-mx:.2f}dB,aformat=channel_layouts=stereo:sample_rates=48000","-c:a","libmp3lame","-b:a","192k",f"{out}/{name}.mp3"],check=True); n += 1
    missing = [m[0] for m in M if not os.path.exists(f"{out}/{m[0]}.mp3")]
    print(f"{n} sfx from {os.path.realpath(REPO_SFX)} → {out}" + (f" · missing (house set used): {', '.join(missing)}" if missing else ""))
    sys.exit(0)
for name, src, L in M:
    if not os.path.exists(LIB + src): print(f"missing in the library, house sound used: {src}"); continue
    fo = min(.25, L * .3); tmp = f"{out}/{name}.wav"
    subprocess.run(["ffmpeg","-v","error","-y","-i",LIB+src,"-af",f"silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:{L},afade=t=out:st={L-fo:.3f}:d={fo:.3f},aformat=channel_layouts=stereo:sample_rates=48000",tmp],check=True)
    mx = float(re.search(r"max_volume: (-?[\d.]+)", subprocess.run(["ffmpeg","-i",tmp,"-af","volumedetect","-f","null","-"],capture_output=True,text=True).stderr).group(1))
    subprocess.run(["ffmpeg","-v","error","-y","-i",tmp,"-af",f"volume={-1-mx:.2f}dB","-c:a","libmp3lame","-b:a","192k",f"{out}/{name}.mp3"],check=True)
    os.remove(tmp)
print(f"{len(M)} sfx → {out}")
