"""Turn a stream moment into a ready-to-post vertical Short (1080x1920) for a clipping campaign.

    python -m clipper.clip URL --hook "HE DID NOT EXPECT THIS 💀" [--start 1:02:10 --end 1:02:45]

URL can be a Twitch clip, a Twitch VOD (then give --start/--end), a YouTube video, or a local file.

What it does:
  1. downloads just the part you asked for (yt-dlp)
  2. finds the streamer's facecam (a face that stays in the same place) and builds a split screen:
     facecam on top, gameplay below. If no facecam is found it uses the full frame on a blurred background.
  3. writes word-by-word captions from the speech (faster-whisper), readable without sound
  4. adds your hook text for the first seconds, the Twitch handle, and a follow call-to-action at the end
  5. saves clips/out/<name>.mp4 plus <name>.txt with the title, description and hashtags to paste
"""
import argparse
import json
import random
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "clipper" / "fonts"
FONT = "Inter ExtraBold"
W, H, FPS = 1080, 1920, 30
CAM_H = 640  # facecam panel height in the split layout
HOOK_SECONDS = 3.0
CTA_SECONDS = 3.5


def run(cmd):
    print("+", " ".join(map(str, cmd))[:400], flush=True)
    subprocess.run([str(c) for c in cmd], check=True)


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height:format=duration", "-of", "json", str(path)],
                         capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    return j["streams"][0]["width"], j["streams"][0]["height"], float(j["format"]["duration"])


def seconds(t):
    """'1:02:10.5' / '62:10' / '3730' -> seconds (float). None stays None."""
    if t in (None, ""):
        return None
    total = 0.0
    for part in str(t).strip().split(":"):
        total = total * 60 + float(part)
    return total


# ---------- 1. get the footage ----------

def fetch(url, start, end, work):
    out = work / "source.mp4"
    if Path(url).exists():  # local file: just cut it
        cut = []
        if start is not None:
            cut += ["-ss", start]
        if end is not None:
            cut += ["-to", end]
        run(["ffmpeg", "-y", "-v", "error", "-i", url, *cut, "-c:v", "libx264", "-preset", "veryfast",
             "-crf", "16", "-c:a", "aac", "-b:a", "192k", out])
        return out
    cmd = ["yt-dlp", "--no-playlist", "-f", "bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b",
           "--merge-output-format", "mp4", "-o", str(out)]
    if start is not None or end is not None:
        cmd += ["--download-sections", f"*{start or 0}-{end if end is not None else 'inf'}",
                "--force-keyframes-at-cuts"]
    run(cmd + [url])
    return out


# ---------- 2. layout ----------

def iou(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    iy = max(0, min(ay + ah, by + bh) - max(ay, by))
    inter = ix * iy
    return inter / float(aw * ah + bw * bh - inter or 1)


def find_facecam(video, w, h, dur, samples=16):
    """A facecam is a face that sits in the same spot in most frames (game characters move around).
    Returns the crop box (x, y, cw, ch) for the top panel, or None."""
    import cv2
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    cap = cv2.VideoCapture(str(video))
    frames = []
    for i in range(samples):
        cap.set(cv2.CAP_PROP_POS_MSEC, dur * (i + 0.5) / samples * 1000)
        ok, frame = cap.read()
        if not ok:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        side = int(h * 0.05)
        frames.append([tuple(int(v) for v in f)
                       for f in cascade.detectMultiScale(gray, 1.1, 6, minSize=(side, side))])
    cap.release()
    best, matches = None, []
    for boxes in frames:
        for b in boxes:
            hits = []
            for other in frames:
                m = max(other, key=lambda o: iou(b, o), default=None)
                if m is not None and iou(b, m) > 0.3:
                    hits.append(m)
            if len(hits) > len(matches):
                best, matches = b, hits
    if not frames or len(matches) < max(3, 0.4 * len(frames)):
        return None
    med = lambda k: sorted(m[k] for m in matches)[len(matches) // 2]
    fx, fy, fw, fh = med(0), med(1), med(2), med(3)
    cw = min(w, fw * 3.4)
    ch = cw * CAM_H / W
    if ch > h:
        ch, cw = h, h * W / CAM_H
    cx, cy = fx + fw / 2, fy + fh * 0.75  # a bit below the face centre, so shoulders show
    x = min(max(cx - cw / 2, 0), w - cw)
    y = min(max(cy - ch / 2, 0), h - ch)
    even = lambda v: int(v) // 2 * 2
    print(f"  facecam found at face {fx},{fy} {fw}x{fh} in {len(matches)}/{len(frames)} frames")
    return even(x), even(y), even(cw), even(ch)


def video_filter(layout, w, h, cam, game_x, ass):
    subs = f"subtitles={ass}:fontsdir={FONTS}"
    if layout == "split":
        x, y, cw, ch = cam
        gh = h
        gw = int(h * W / (H - CAM_H)) // 2 * 2
        if gw > w:
            gw, gh = w // 2 * 2, int(w * (H - CAM_H) / W) // 2 * 2
        gx = int(min(max((w - gw) * game_x, 0), w - gw)) // 2 * 2
        gy = (h - gh) // 2 // 2 * 2
        return (f"[0:v]split[c][g];[c]crop={cw}:{ch}:{x}:{y},scale={W}:{CAM_H},setsar=1[cam];"
                f"[g]crop={gw}:{gh}:{gx}:{gy},scale={W}:{H - CAM_H},setsar=1[game];"
                f"[cam][game]vstack,drawbox=y={CAM_H - 3}:w=iw:h=6:color=0x9146FF:t=fill,fps={FPS},{subs}[v]")
    if layout == "full":
        cw = int(h * 9 / 16) // 2 * 2
        gx = int(min(max((w - cw) * game_x, 0), w - cw)) // 2 * 2
        return f"[0:v]crop={cw}:{h}:{gx}:0,scale={W}:{H},setsar=1,fps={FPS},{subs}[v]"
    # blur: the whole frame in the middle, a blurred zoomed copy behind it
    return (f"[0:v]split[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
            f"boxblur=28:4,eq=brightness=-0.18[bg];[b]scale={W}:-2,setsar=1[fg];"
            f"[bg][fg]overlay=0:(H-h)/2,fps={FPS},{subs}[v]")


# ---------- 3. captions ----------

def transcribe(video, model_name):
    from faster_whisper import WhisperModel
    print(f"  transcribing with whisper {model_name}...", flush=True)
    import numpy as np
    # Decode with our own ffmpeg (16 kHz mono float) so faster-whisper never needs PyAV.
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000",
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, dtype=np.float32)
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio, language="en", word_timestamps=True, vad_filter=True)
    return [(w.word.strip(), w.start, w.end) for s in segments for w in (s.words or []) if w.word.strip()]


def ass_time(t):
    t = max(t, 0)
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def esc(text):
    """Escape ASS override braces and drop emoji (the caption font has none; they stay in the title)."""
    text = re.sub(r"[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\u200D]", "", text)
    return re.sub(r"\s+", " ", text).strip().replace("{", "(").replace("}", ")")


def chunks(words, size=3, gap=0.35):
    group = []
    for i, (word, start, end) in enumerate(words):
        if group and (len(group) >= size or start - group[-1][2] > gap or group[-1][0][-1:] in ".?!"):
            yield group
            group = []
        group.append((word, start, end))
    if group:
        yield group


def write_ass(path, words, dur, layout, hook, cta, handle):
    if layout == "split":
        hook_y, cap_y, cta_y, handle_y = CAM_H, 1330, 1000, CAM_H + 48
    elif layout == "full":
        hook_y, cap_y, cta_y, handle_y = 520, 1250, 900, 1560
    else:
        fg_top = (H - W * 9 // 16) // 2
        hook_y, cap_y, cta_y, handle_y = fg_top - 110, H - fg_top + 150, fg_top - 110, H - fg_top + 40
    style = "0,0,0,0,100,100,0,0"
    lines = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 0",
        "ScaledBorderAndShadow: yes", "", "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, "
        "Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Cap,{FONT},92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,{style},1,7,3,5,60,60,0,1",
        f"Style: Hook,{FONT},66,&H00000000,&H00000000,&H00FFFFFF,&H00FFFFFF,{style},3,16,0,5,70,70,0,1",
        f"Style: Cta,{FONT},62,&H00FFFFFF,&H00FFFFFF,&H00FF4691,&H00FF4691,{style},3,22,0,5,70,70,0,1",
        f"Style: Handle,{FONT},38,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,{style},1,3,0,5,40,40,0,1",
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    def event(start, end, style_name, text, layer=0):
        lines.append(f"Dialogue: {layer},{ass_time(start)},{ass_time(end)},{style_name},,0,0,0,,{text}")

    hook_end = min(HOOK_SECONDS, dur)
    cta_start = max(dur - CTA_SECONDS, hook_end)
    if hook:
        event(0, hook_end, "Hook", f"{{\\pos({W // 2},{hook_y})\\fad(0,150)}}{esc(hook.upper())}", 2)
    if handle:
        event(hook_end if hook else 0, dur, "Handle", f"{{\\pos({W // 2},{handle_y})\\1a&H30&}}{esc(handle)}", 1)
    if cta:
        event(cta_start, dur, "Cta", f"{{\\pos({W // 2},{cta_y})\\fad(200,0)"
                                      f"\\fscx70\\fscy70\\t(0,180,\\fscx100\\fscy100)}}{cta}", 3)

    groups = list(chunks(words))
    for gi, group in enumerate(groups):
        g_start = group[0][1]
        g_end = min(groups[gi + 1][0][1] if gi + 1 < len(groups) else dur, group[-1][2] + 0.6)
        clean = [re.sub(r"[^\w'?!%$#&-]", "", w).upper() or w.upper() for w, _, _ in group]
        for wi, (_, w_start, _) in enumerate(group):
            start = g_start if wi == 0 else w_start
            end = group[wi + 1][1] if wi + 1 < len(group) else g_end
            if end <= start:
                continue
            parts = [f"{{\\c&H00E5FF&}}{esc(c)}{{\\c&HFFFFFF&}}" if i == wi else esc(c) for i, c in enumerate(clean)]
            pop = "\\fscx85\\fscy85\\t(0,90,\\fscx100\\fscy100)" if wi == 0 else ""
            event(start, end, "Cap", f"{{\\pos({W // 2},{cap_y}){pop}}}" + " ".join(parts))
    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")


# ---------- 4. post text ----------

def post_text(campaign, title, hook, words):
    tags = list(campaign.get("always", []))
    extra = [t for t in campaign.get("hashtags", []) if t not in tags]
    random.shuffle(extra)  # the brief asks to mix hashtags up between posts
    tags += extra[:4]
    if not title:
        base = hook.title() if hook else f"{campaign.get('streamer', '')} GTA 6 Moment"
        title = base if re.search(r"[^\x00-\x7F]", base) else f"{base} 😭"
    title = f"{title} {' '.join(tags[:2])}"[:100]
    desc = (f"Follow {campaign.get('streamer', '')} live 👉 {campaign.get('handle', '')}\n\n" + " ".join(tags))
    said = " ".join(w for w, _, _ in words)[:300]
    return title, desc, said


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50] or "clip"


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("url")
    p.add_argument("--start", help="start time in the source, e.g. 1:02:10 (needed for long VODs)")
    p.add_argument("--end", help="end time in the source")
    p.add_argument("--hook", default="", help="big text shown for the first 3 seconds")
    p.add_argument("--title", default="", help="YouTube title (hashtags get added)")
    p.add_argument("--campaign", default="bobby", help="key in clipper/campaigns.json")
    p.add_argument("--layout", default="auto", choices=["auto", "split", "blur", "full"])
    p.add_argument("--cam", help="facecam box in the source as x,y,w,h pixels (overrides detection)")
    p.add_argument("--game-x", type=float, default=0.5, help="gameplay crop position, 0=left 0.5=centre 1=right")
    p.add_argument("--model", default="base.en", help="whisper model: tiny.en, base.en, small.en")
    p.add_argument("--no-captions", action="store_true")
    p.add_argument("--words-json", help=argparse.SUPPRESS)  # testing: skip whisper
    p.add_argument("--out", default=str(ROOT / "clips" / "out"))
    a = p.parse_args(argv)

    campaign = json.loads((ROOT / "clipper" / "campaigns.json").read_text())[a.campaign]
    name = slug(a.title or a.hook or Path(a.url).stem)
    work = ROOT / "clips" / "work" / name
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    out_dir = Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    start, end = seconds(a.start), seconds(a.end)
    if start is not None and end is not None and end <= start:
        sys.exit("--end must be after --start")
    src = fetch(a.url, start, end, work)
    w, h, dur = probe(src)
    print(f"  source: {w}x{h}, {dur:.1f}s")
    if dur > 180:
        print("  WARNING: longer than 3 minutes. Shorts must be 3 min or less; aim for 20-45 s.")

    layout, cam = a.layout, None
    if a.cam:
        cam = tuple(int(v) // 2 * 2 for v in a.cam.split(","))
        layout = "split" if layout == "auto" else layout
    elif layout in ("auto", "split"):
        cam = find_facecam(src, w, h, dur)
        if cam is None:
            if layout == "split":
                print("  no facecam found; give --cam x,y,w,h. Falling back to blur layout.")
            layout = "blur"
        else:
            layout = "split"
    print(f"  layout: {layout}")

    if a.no_captions:
        words = []
    elif a.words_json:
        words = [tuple(x) for x in json.loads(Path(a.words_json).read_text())]
    else:
        words = transcribe(src, a.model)
    ass = work / "captions.ass"
    write_ass(ass, words, dur, layout, a.hook, campaign.get("cta", ""), campaign.get("handle", ""))

    video = out_dir / f"{name}.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-i", src, "-filter_complex",
         video_filter(layout, w, h, cam, a.game_x, ass), "-map", "[v]", "-map", "0:a?",
         "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:v", "libx264", "-preset", "medium", "-crf", "21",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", video])

    title, desc, said = post_text(campaign, a.title, a.hook, words)
    (out_dir / f"{name}.txt").write_text(
        f"TITLE:\n{title}\n\nDESCRIPTION:\n{desc}\n\n"
        f"BEFORE YOU POST: likes visible, English only, keep it up 30 days.\n"
        f"AFTER YOU POST: submit the link in Content Rewards within 30 minutes.\n\n"
        f"(What was said, for checking the captions: {said})\n", encoding="utf-8")
    shutil.rmtree(work, ignore_errors=True)
    print(f"\nDONE: {video}\n      {out_dir / (name + '.txt')}")


if __name__ == "__main__":
    main()
