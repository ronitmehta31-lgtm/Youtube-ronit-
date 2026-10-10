"""Make a profile picture (800x800) and banner (2560x1440) for the channel with fal.ai.

    FAL_KEY=... python -m autotube.channel_art      # writes assets/channel/
"""
import json
import subprocess
import tempfile
from pathlib import Path

from . import visuals
from .render import ass_header

ROOT = Path(__file__).resolve().parent.parent
STYLE = "warm 2D storybook illustration, soft painterly colours, cinematic lighting, highly detailed, no text, no letters"
PROFILE = ("a kind elderly Indian grandmother in a white saree telling a story by the light of an oil lamp, "
           "a glowing open storybook in her hands, cosy village home at night, centred portrait, " + STYLE)
BANNER = ("panoramic north Indian village at golden sunset, mud houses, a big banyan tree, children and a grandmother "
          "sitting under the tree listening to a story, fields and a small temple in the distance, wide calm sky "
          "across the middle, " + STYLE)


def overlay(src, out, w, h, events, work):
    style = ("Style: Big,Noto Sans,10,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,"
             "1,6,4,5,40,40,40,1")
    (work / "t.ass").write_text(ass_header(w, h, style) + "".join(
        f"Dialogue: 0,0:00:00.00,0:00:05.00,Big,,0,0,0,,{e}\n" for e in events), encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vf",
                    f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},ass=t.ass",
                    "-frames:v", "1", "-q:v", "2", str(Path(out).resolve())], check=True, cwd=work)


def main():
    ch = json.loads((ROOT / "autotube" / "config.json").read_text())["channel"]
    out = ROOT / "assets" / "channel"
    out.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp())
    if not visuals.ai_image(PROFILE, work / "p.jpg", 1024, 1024, 11):
        raise SystemExit("could not generate the profile picture")
    overlay(work / "p.jpg", out / "profile.jpg", 800, 800,
            [f"{{\\pos(400,625)\\fs100\\c&H0000E5FF&\\bord8}}{ch['name_hi']}"], work)
    if not visuals.ai_image(BANNER, work / "b.jpg", 2048, 1152, 12):
        raise SystemExit("could not generate the banner")
    # YouTube shows only the middle 1546x423 on every device, so keep the text there.
    overlay(work / "b.jpg", out / "banner.jpg", 2560, 1440, [
        f"{{\\pos(1280,665)\\fs150\\c&H0000E5FF&\\bord9}}{ch['name_hi']} | {ch['name']}",
        f"{{\\pos(1280,800)\\fs78\\bord6}}{ch['tagline_hi']}",
    ], work)
    print("wrote", out / "profile.jpg", out / "banner.jpg")


if __name__ == "__main__":
    main()
