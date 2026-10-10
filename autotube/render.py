"""Turn a queued script (JSON) into a 1080x1920 Short with voiceover, footage and captions.

    python -m autotube.render queue/my-video.json out.mp4
"""
import json
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from . import tts, visuals

ROOT = Path(__file__).resolve().parent.parent
W, H, FPS = 1080, 1920, 30
PAUSE = 0.25  # silence after each scene, seconds
WORDS_PER_CAPTION = 3
FALLBACK_COLORS = [("0x0f2027", "0x2c5364"), ("0x41295a", "0x2f0743"), ("0x1d4350", "0xa43931"),
                   ("0x093028", "0x237a57"), ("0x232526", "0x414345")]


def run(*cmd, cwd=None):
    subprocess.run(cmd, check=True, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def ass_time(t):
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def write_captions(scenes, path):
    """scenes: one list of (word, start, end) per scene; captions never span two scenes."""
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,DejaVu Sans,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,7,3,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    groups = [words[i:i + WORDS_PER_CAPTION] for words in scenes for i in range(0, len(words), WORDS_PER_CAPTION)]
    for n, group in enumerate(groups):
        end = group[-1][2] + 0.15
        if n + 1 < len(groups):
            end = min(end, groups[n + 1][0][1])  # never show two captions at once
        text = " ".join(w for w, _, _ in group).upper().replace("{", "(").replace("}", ")")
        # \pos puts captions a little below the middle; \fad gives a tiny pop-in.
        lines.append(f"Dialogue: 0,{ass_time(group[0][1])},{ass_time(end)},Cap,,0,0,0,,"
                     f"{{\\pos({W // 2},{int(H * 0.62)})\\fad(60,0)}}{text}")
    Path(path).write_text(head + "\n".join(lines) + "\n", encoding="utf-8")


def scene_video(visual, kind, seconds, out, colors, zoom_in=True):
    common = ["-t", f"{seconds:.3f}", "-an", "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast",
              "-crf", "23", "-pix_fmt", "yuv420p", str(out)]
    if kind == "video":
        run("ffmpeg", "-y", "-stream_loop", "-1", "-i", str(visual),
            "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1", *common)
    elif kind == "image":
        # Slow "Ken Burns" zoom so a still photo feels like footage; alternate in and out per scene.
        frames = int(seconds * FPS) + 1
        zoom = f"1+0.15*on/{frames}" if zoom_in else f"1.15-0.15*on/{frames}"
        bw, bh = W * 3 // 2, H * 3 // 2  # work larger than the output so the zoom stays smooth
        run("ffmpeg", "-y", "-i", str(visual), "-vf",
            f"scale={bw}:{bh}:force_original_aspect_ratio=increase,crop={bw}:{bh},setsar=1,"
            f"zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS}",
            "-frames:v", str(frames), *common)
    else:
        run("ffmpeg", "-y", "-f", "lavfi",
            "-i", f"gradients=s={W}x{H}:c0={colors[0]}:c1={colors[1]}:speed=0.008:r={FPS}", *common)


def render(script_path, out_path):
    """Render the video. Returns credit lines for any photos that need attribution."""
    config = json.loads((ROOT / "autotube" / "config.json").read_text())
    script = json.loads(Path(script_path).read_text())
    voice = script.get("voice", config["voice"])
    rate = script.get("voice_rate", config["voice_rate"])
    colors = random.choice(FALLBACK_COLORS)

    work = Path(tempfile.mkdtemp(prefix="autotube-"))
    try:
        all_words, scene_files, audio_files, t = [], [], [], 0.0
        used_clips, credits = set(), []
        for i, scene in enumerate(script["scenes"]):
            print(f"  scene {i + 1}/{len(script['scenes'])}: {scene['text'][:60]}")
            mp3 = work / f"s{i}.mp3"
            words = tts.synthesize(scene["text"], voice, rate, mp3)
            seconds = duration(mp3) + PAUSE
            all_words.append([(w, a + t, b + t) for w, a, b in words])

            wav = work / f"s{i}.wav"  # pad each scene's speech with a short silence
            run("ffmpeg", "-y", "-i", str(mp3), "-af", f"apad=pad_dur={PAUSE}", "-ar", "44100", "-ac", "2", str(wav))
            audio_files.append(wav)

            visual, kind, credit = visuals.fetch_visual(scene.get("search", ""), work, i, seconds, used_clips)
            print(f"    visual: {kind or 'none, using a gradient'}")
            if credit and credit not in credits:
                credits.append(credit)
            scene_video(visual, kind, seconds, work / f"v{i}.mp4", colors, zoom_in=i % 2 == 0)
            scene_files.append(work / f"v{i}.mp4")
            t += seconds

        if t > 175:
            print(f"  warning: {t:.0f}s is longer than YouTube's 3-minute Shorts limit")

        (work / "v.txt").write_text("".join(f"file '{p.name}'\n" for p in scene_files))
        run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "v.txt", "-c", "copy", "video.mp4", cwd=work)
        (work / "a.txt").write_text("".join(f"file '{p.name}'\n" for p in audio_files))
        run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "a.txt", "-c", "copy", "voice.wav", cwd=work)
        write_captions(all_words, work / "captions.ass")

        music = sorted((ROOT / "assets" / "music").glob("*.mp3"))
        inputs = ["-i", "video.mp4", "-i", "voice.wav"]
        if music:
            inputs += ["-stream_loop", "-1", "-i", str(random.choice(music))]
            audio = (f"[2:a]volume={config['music_volume']}[m];"
                     "[1:a][m]amix=inputs=2:duration=first:normalize=0[a]")
        else:
            audio = "[1:a]anull[a]"
        run("ffmpeg", "-y", *inputs, "-filter_complex", f"[0:v]ass=captions.ass[v];{audio}",
            "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "21",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
            "final.mp4", cwd=work)
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(work / "final.mp4"), out_path)
        print(f"  rendered {out_path} ({t:.1f}s)")
        return credits
    except subprocess.CalledProcessError as e:
        sys.exit(f"ffmpeg failed: {e.stderr.decode(errors='replace')[-1500:]}")
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2])
