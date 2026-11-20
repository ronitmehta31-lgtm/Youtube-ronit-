"""Draw the Clip Vault profile picture (800x800) and banner (2560x1440) with Pillow. No AI, no cost.

    python -m autotube.clip_vault_art
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "channel" / "clip-vault"
FONT = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
SEMI = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
CYAN, MAGENTA, BG = (0, 229, 255), (255, 46, 196), (12, 12, 20)


def background(w, h, seed=7):
    img = Image.new("RGB", (w, h), BG)
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((-w * 0.3, -h * 0.4, w * 0.55, h * 0.9), fill=(0, 70, 95))
    d.ellipse((w * 0.45, h * 0.1, w * 1.3, h * 1.4), fill=(90, 10, 75))
    glow = glow.filter(ImageFilter.GaussianBlur(min(w, h) * 0.25))
    img = Image.blend(img, glow, 0.85)
    rnd = random.Random(seed)
    d = ImageDraw.Draw(img)
    for _ in range(int(w * h / 9000)):  # faint sparkles
        x, y, r = rnd.uniform(0, w), rnd.uniform(0, h), rnd.uniform(1, 3) * w / 2560 * 2
        c = rnd.choice([CYAN, MAGENTA, (255, 255, 255)])
        d.ellipse((x - r, y - r, x + r, y + r), fill=tuple(int(v * 0.35) for v in c))
    return img


def neon(base, draw_fn, color, blur):
    """Draw shapes with draw_fn on a layer, add a blurred glow under them."""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer), color)
    halo = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(halo)
    base.alpha_composite(halo)
    base.alpha_composite(layer)


def vault_icon(img, cx, cy, r):
    """Vault door ring with bolts and a play button in the middle."""
    w = max(4, int(r * 0.09))

    def ring(d, c):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=c, width=w)
        ri = r * 0.78
        d.ellipse((cx - ri, cy - ri, cx + ri, cy + ri), outline=c, width=max(2, w // 2))
        for k in range(8):  # bolts between the two rings
            a = k * math.pi / 4 + math.pi / 8
            bx, by, br = cx + math.cos(a) * r * 0.89, cy + math.sin(a) * r * 0.89, r * 0.045
            d.ellipse((bx - br, by - br, bx + br, by + br), fill=c)

    def play(d, c):
        s = r * 0.42
        d.polygon([(cx - s * 0.62, cy - s), (cx - s * 0.62, cy + s), (cx + s * 1.0, cy)], fill=c)

    neon(img, ring, CYAN + (255,), r * 0.08)
    neon(img, play, MAGENTA + (255,), r * 0.1)


def text(img, xy, s, size, font=FONT, color=(255, 255, 255), glow=MAGENTA, anchor="mm", spacing=0):
    f = ImageFont.truetype(font, size)

    def draw(d, c):
        d.text(xy, s, font=f, fill=c, anchor=anchor)
    if glow:
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).text(xy, s, font=f, fill=glow + (255,), anchor=anchor)
        img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(size * 0.12)))
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw(ImageDraw.Draw(layer), color + (255,))
    img.alpha_composite(layer)


def profile():
    S = 1600  # draw at 2x, then shrink for clean edges
    img = background(S, S).convert("RGBA")
    vault_icon(img, S / 2, S * 0.43, S * 0.29)
    text(img, (S / 2, S * 0.83), "CLIP VAULT", int(S * 0.115))
    return img.convert("RGB").resize((800, 800), Image.LANCZOS)


def banner():
    W, H = 2560, 1440
    img = background(W, H, seed=3).convert("RGBA")
    d = ImageDraw.Draw(img)
    rnd = random.Random(11)
    for _ in range(14):  # diagonal light streaks outside the safe area
        y = rnd.uniform(0, H)
        x = rnd.choice([rnd.uniform(-200, 400), rnd.uniform(2100, 2700)])
        c = rnd.choice([CYAN, MAGENTA])
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(layer).line((x, y, x + 500, y - 260), fill=c + (150,), width=rnd.randint(3, 8))
        img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(6)))
        img.alpha_composite(layer)
    # Safe area (visible on every device) is the centre 1546x423.
    vault_icon(img, 900, 720, 160)
    text(img, (1110, 685), "CLIP VAULT", 150, anchor="lm")
    text(img, (1114, 800), "The best moments. Every day.", 62, font=SEMI, color=(200, 245, 255), glow=None, anchor="lm")
    return img.convert("RGB")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    profile().save(OUT / "profile.png")
    banner().save(OUT / "banner.jpg", quality=93)
    print(f"saved to {OUT}")


if __name__ == "__main__":
    main()
