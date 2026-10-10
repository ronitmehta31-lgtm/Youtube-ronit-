"""Turn a queued script (JSON) into videos with voiceover, visuals and captions.

A script with "format": "long" becomes a 1920x1080 video plus, if it has a "short" section, a vertical
teaser made from its opening scenes. Anything else becomes a 1080x1920 Short.

    python -m autotube.render queue/my-video.json out/
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
FPS = 30
FORMATS = {"short": (1080, 1920), "long": (1920, 1080)}
PAUSE = 0.25  # silence after each scene, seconds
LINE_GAP = 0.35  # silence between two lines in the same scene
TEASER_MAX = 55  # seconds of story in a Short teaser, before its closing line
FALLBACK_COLORS = [("0x0f2027", "0x2c5364"), ("0x41295a", "0x2f0743"), ("0x1d4350", "0xa43931"),
                   ("0x093028", "0x237a57"), ("0x232526", "0x414345")]


def run(*cmd, cwd=None):
    subprocess.run(cmd, check=True, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def probe(path, entries):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", entries, "-of", "csv=p=0:s=x", str(path)],
                         check=True, capture_output=True, text=True).stdout
    return out.strip().splitlines()[0]


def duration(path):
    return float(probe(path, "format=duration"))


def ass_time(t):
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def ass_header(w, h, style):
    return f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{style}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def write_captions(lines, path, fmt, per_caption):
    """lines: one list of (word, start, end) per spoken line; captions never span two lines."""
    w, h = FORMATS[fmt]
    if fmt == "long":  # subtitles along the bottom
        size, y, outline, upper = 62, int(h * 0.88), 5, False
    else:  # big words a little below the middle
        size, y, outline, upper = 96, int(h * 0.62), 7, True
    style = (f"Style: Cap,Noto Sans,{size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,"
             f"1,{outline},3,5,60,60,0,1")
    events = []
    groups = [words[i:i + per_caption] for words in lines for i in range(0, len(words), per_caption)]
    for n, group in enumerate(groups):
        end = group[-1][2] + 0.15
        if n + 1 < len(groups):
            end = min(end, groups[n + 1][0][1])  # never show two captions at once
        text = " ".join(word for word, _, _ in group).replace("{", "(").replace("}", ")")
        events.append(f"Dialogue: 0,{ass_time(group[0][1])},{ass_time(end)},Cap,,0,0,0,,"
                      f"{{\\pos({w // 2},{y})\\fad(60,0)}}{text.upper() if upper else text}")
    Path(path).write_text(ass_header(w, h, style) + "\n".join(events) + "\n", encoding="utf-8")


def scene_video(visual, kind, seconds, out, fmt, colors, zoom_in=True):
    w, h = FORMATS[fmt]
    frames = int(seconds * FPS) + 1
    common = ["-t", f"{seconds:.3f}", "-an", "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast",
              "-crf", "23", "-pix_fmt", "yuv420p", str(out)]
    zoom = f"1+0.12*on/{frames}" if zoom_in else f"1.12-0.12*on/{frames}"
    if kind == "video":
        run("ffmpeg", "-y", "-stream_loop", "-1", "-i", str(visual),
            "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1", *common)
    elif kind == "image":
        iw, ih = (int(v) for v in probe(visual, "stream=width,height").split("x"))
        if fmt == "short" and iw > ih:
            # Wide picture in a tall video: show all of it over a blurred copy, zooming gently.
            fw, fh = w, (w * ih // iw) // 2 * 2
            run("ffmpeg", "-y", "-loop", "1", "-i", str(visual), "-i", str(visual), "-filter_complex",
                f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},gblur=sigma=40,"
                f"eq=brightness=-0.12,setsar=1[bg];"
                f"[1:v]scale={fw * 3 // 2}:{fh * 3 // 2},setsar=1,"
                f"zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={fw}x{fh}:fps={FPS}[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2-{h // 10}:shortest=1",
                "-frames:v", str(frames), *common)
        else:
            # Slow "Ken Burns" zoom so a still picture feels alive; alternate in and out per scene.
            bw, bh = w * 3 // 2, h * 3 // 2  # work larger than the output so the zoom stays smooth
            run("ffmpeg", "-y", "-i", str(visual), "-vf",
                f"scale={bw}:{bh}:force_original_aspect_ratio=increase,crop={bw}:{bh},setsar=1,"
                f"zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={w}x{h}:fps={FPS}",
                "-frames:v", str(frames), *common)
    else:
        run("ffmpeg", "-y", "-f", "lavfi",
            "-i", f"gradients=s={w}x{h}:c0={colors[0]}:c1={colors[1]}:speed=0.008:r={FPS}", *common)


def speak(line, name, work, config, voice, rate, gap):
    """Synthesize one line. Returns {"wav", "words" (relative to the line start), "seconds"}."""
    mp3 = work / f"{name}.mp3"
    words = tts.synthesize(line["text"], config.get("voices", {}).get(line.get("lang"), voice), rate, mp3)
    wav = work / f"{name}.wav"  # pad each line's speech with a short silence
    run("ffmpeg", "-y", "-i", str(mp3), "-af", f"apad=pad_dur={gap}", "-ar", "44100", "-ac", "2", str(wav))
    return {"wav": wav, "words": words, "seconds": duration(mp3) + gap}


def prepare(script, config, work, fmt):
    """Voice every line and fetch every visual once, so several videos can reuse them."""
    voice = script.get("voice", config["voice"])
    rate = script.get("voice_rate", config["voice_rate"])
    style = script.get("style", "")
    used, credits, scenes = set(), [], []
    for i, scene in enumerate(script["scenes"]):
        # A scene is one visual with one or more spoken lines, each optionally in its own language/voice.
        lines = scene.get("lines") or [{"text": scene["text"]}]
        print(f"  scene {i + 1}/{len(script['scenes'])}: {lines[0]['text'][:60]}")
        spoken = [speak(line, f"s{i}_{j}", work, config, voice, rate, PAUSE if j == len(lines) - 1 else LINE_GAP)
                  for j, line in enumerate(lines)]
        seconds = sum(s["seconds"] for s in spoken)
        prompt = f"{scene['image']}. {style}" if scene.get("image") else None
        visual, kind, credit = visuals.fetch_visual(scene.get("search", ""), work, i, seconds, used,
                                                    image_prompt=prompt, size=FORMATS[fmt],
                                                    seed=script.get("seed", 42))
        print(f"    visual: {kind or 'none, using a gradient'}")
        if credit and credit not in credits:
            credits.append(credit)
        scenes.append({"spoken": spoken, "seconds": seconds, "visual": visual, "kind": kind})
    return scenes, credits


def compose(scenes, fmt, out_path, work, config, tag):
    """Cut prepared scenes into one finished video."""
    colors = random.choice(FALLBACK_COLORS)
    caption_lines, clips, wavs, t = [], [], [], 0.0
    for k, sc in enumerate(scenes):
        clip = work / f"{tag}_v{k}.mp4"
        scene_video(sc["visual"], sc["kind"], sc["seconds"], clip, fmt, colors, zoom_in=k % 2 == 0)
        clips.append(clip)
        start = t
        for s in sc["spoken"]:
            caption_lines.append([(word, a + start, b + start) for word, a, b in s["words"]])
            wavs.append(s["wav"])
            start += s["seconds"]
        t += sc["seconds"]
    if fmt == "short" and t > 175:
        print(f"  warning: {t:.0f}s is longer than YouTube's 3-minute Shorts limit")

    (work / f"{tag}_v.txt").write_text("".join(f"file '{p.name}'\n" for p in clips))
    run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", f"{tag}_v.txt", "-c", "copy", f"{tag}_video.mp4", cwd=work)
    (work / f"{tag}_a.txt").write_text("".join(f"file '{p.name}'\n" for p in wavs))
    run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", f"{tag}_a.txt", "-c", "copy", f"{tag}_voice.wav", cwd=work)
    per_caption = 6 if fmt == "long" else config.get("words_per_caption", 3)
    write_captions(caption_lines, work / f"{tag}_captions.ass", fmt, per_caption)

    music = sorted((ROOT / "assets" / "music").glob("*.mp3"))
    inputs = ["-i", f"{tag}_video.mp4", "-i", f"{tag}_voice.wav"]
    if music:
        inputs += ["-stream_loop", "-1", "-i", str(random.choice(music))]
        audio = (f"[2:a]volume={config['music_volume']}[m];"
                 "[1:a][m]amix=inputs=2:duration=first:normalize=0[a]")
    else:
        audio = "[1:a]anull[a]"
    run("ffmpeg", "-y", *inputs, "-filter_complex", f"[0:v]ass={tag}_captions.ass[v];{audio}",
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "faster" if fmt == "long" else "medium",
        "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest",
        "-movflags", "+faststart", f"{tag}_final.mp4", cwd=work)
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(work / f"{tag}_final.mp4"), out_path)
    print(f"  rendered {out_path} ({t / 60:.1f} min)")


def make_thumbnail(image, text, out_path, work):
    """1280x720 thumbnail: the picture with big outlined text along the bottom."""
    style = ("Style: Thumb,Noto Sans,118,&H0000FFFF,&H0000FFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,"
             "1,10,5,2,50,50,45,1")
    ass = work / "thumb.ass"
    ass.write_text(ass_header(1280, 720, style) + f"Dialogue: 0,0:00:00.00,0:00:05.00,Thumb,,0,0,0,,{text}\n",
                   encoding="utf-8")
    run("ffmpeg", "-y", "-i", str(image), "-vf",
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,ass=thumb.ass",
        "-frames:v", "1", "-q:v", "3", str(Path(out_path).resolve()), cwd=work)


def render(script_path, out_dir):
    """Render every video for one script.

    Returns {"main": path, "short": path or None, "thumbnail": path or None, "credits": [...]}.
    """
    config = json.loads((ROOT / "autotube" / "config.json").read_text())
    script = json.loads(Path(script_path).read_text())
    fmt = "long" if script.get("format") == "long" else "short"
    stem = Path(script_path).stem
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    result = {"main": out_dir / f"{stem}.mp4", "short": None, "thumbnail": None}

    work = Path(tempfile.mkdtemp(prefix="autotube-"))
    try:
        scenes, result["credits"] = prepare(script, config, work, fmt)
        result["missing_visuals"] = sum(1 for sc in scenes if not sc["visual"]) / len(scenes)
        compose(scenes, fmt, result["main"], work, config, "main")

        thumb = script.get("thumbnail")
        if fmt == "long" and thumb:
            picture = scenes[thumb.get("scene", 0)]["visual"]
            if picture and scenes[thumb.get("scene", 0)]["kind"] == "image":
                result["thumbnail"] = out_dir / f"{stem}-thumb.jpg"
                make_thumbnail(picture, thumb["text"], result["thumbnail"], work)

        teaser = script.get("short")
        if fmt == "long" and teaser:
            print("  making the Short teaser")
            picked, total = [], 0.0
            for sc in ([scenes[i] for i in teaser["scenes"]] if teaser.get("scenes") else scenes):
                if picked and total + sc["seconds"] > TEASER_MAX:
                    break
                picked.append(sc)
                total += sc["seconds"]
            voice = script.get("voice", config["voice"])
            rate = script.get("voice_rate", config["voice_rate"])
            outro = speak({"text": teaser["outro"]}, "teaser_outro", work, config, voice, rate, 0.6)
            picked.append({"spoken": [outro], "seconds": outro["seconds"],
                           "visual": scenes[0]["visual"], "kind": scenes[0]["kind"]})
            result["short"] = out_dir / f"{stem}-short.mp4"
            compose(picked, "short", result["short"], work, config, "teaser")
        return result
    except subprocess.CalledProcessError as e:
        sys.exit(f"ffmpeg failed: {e.stderr.decode(errors='replace')[-1500:]}")
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    print(render(sys.argv[1], sys.argv[2]))
