"""Generate LUMA's app icons from its signature mark.

The mark: two faint, tilted lines (a line on a photographed page) resolving
into one bold, straight teal line (the same line as clean, adjustable text).

Usage:  python -I design/icons/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "mobile" / "assets" / "images"
WEB = ROOT / "web" / "public"
PAPER = (245, 239, 227, 255)
INK = (29, 27, 24)
TEAL = (10, 86, 81, 255)
S = 4  # supersampling factor


def capsule(draw, p1, p2, width, fill):
    """A line with round caps."""
    draw.line([p1, p2], fill=fill, width=width)
    r = width / 2
    for x, y in (p1, p2):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def mark(size, scale=1.0, faint=(29, 27, 24, 110), bold=TEAL, bg=None):
    """Draw the mark centred in a size x size canvas, using `scale` of the width."""
    n = size * S
    img = Image.new("RGBA", (n, n), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = n * scale / 100.0  # 100-unit design grid
    ox = (n - 100 * u) / 2
    oy = (n - 100 * u) / 2
    P = lambda x, y: (ox + x * u, oy + y * u)
    capsule(d, P(14, 30), P(64, 21), int(5.5 * u), faint)
    capsule(d, P(16, 47), P(66, 38), int(5.5 * u), faint)
    capsule(d, P(22, 72), P(86, 72), int(12 * u), bold)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # Adaptive icon: background + foreground kept inside the 66% safe zone.
    Image.new("RGBA", (1024, 1024), PAPER).save(OUT / "android-icon-background.png")
    mark(1024, scale=0.58).save(OUT / "android-icon-foreground.png")
    mono = mark(1024, scale=0.58, faint=(255, 255, 255, 150), bold=(255, 255, 255, 255))
    mono.save(OUT / "android-icon-monochrome.png")
    # Legacy square icon and splash mark.
    full = Image.new("RGBA", (1024, 1024), PAPER)
    full.alpha_composite(mark(1024, scale=0.7))
    full.save(OUT / "icon.png")
    mark(512, scale=0.9).save(OUT / "splash-icon.png")
    small = Image.new("RGBA", (48, 48), PAPER)
    small.alpha_composite(mark(48, scale=0.9, faint=(29, 27, 24, 150)))
    small.save(OUT / "favicon.png")
    # Website icons.
    WEB.mkdir(parents=True, exist_ok=True)
    full.resize((180, 180), Image.LANCZOS).save(WEB / "apple-touch-icon.png")
    full.resize((512, 512), Image.LANCZOS).save(WEB / "icon-512.png")
    full.resize((32, 32), Image.LANCZOS).save(WEB / "icon-32.png")
    print("icons written")


if __name__ == "__main__":
    main()
