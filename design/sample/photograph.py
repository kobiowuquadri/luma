"""Turn the flat sample handout into a believable phone photo.

The sample handout (handout.html) is original content written for LUMA's
demo. This script warps it onto a desk with uneven light, camera softness
and sensor noise, so the app's sample scan and the website preview use a
realistic, clearly labelled sample photo rather than a real student's page.

Usage:  python -I design/sample/photograph.py
Outputs:
  mobile/assets/sample/handout.jpg   bundled "Try the sample handout"
  web/public/sample/handout.webp     website reader preview (and .jpg fallback)
  web/public/sample/line.webp        one photographed line, for the hero
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "design" / "sample" / "handout-flat.png"
# Page corners in the photo: slightly rotated and keystoned, as if the phone
# is held a little above and to the right of the desk. Shared with lines.py.
QUAD = [(150, 118), (1372, 168), (1408, 1888), (104, 1850)]
CANVAS = (1500, 2000)
WEB_SIZE = (900, 1200)


def perspective_coeffs(dst, src):
    """Coefficients for Image.transform(PERSPECTIVE) mapping dst quad -> src quad."""
    rows, rhs = [], []
    for (x, y), (u, v) in zip(dst, src):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); rhs.append(u)
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y]); rhs.append(v)
    return np.linalg.solve(np.array(rows, float), np.array(rhs, float)).tolist()


def main():
    page = Image.open(SRC).convert("RGB")
    w, h = page.size
    cw, ch = CANVAS
    coeffs = perspective_coeffs(QUAD, [(0, 0), (w, 0), (w, h), (0, h)])
    warped = page.transform((cw, ch), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    mask = Image.new("L", (w, h), 255).transform((cw, ch), Image.PERSPECTIVE, coeffs, Image.BICUBIC)

    rng = np.random.default_rng(7)
    # Desk: dark wood-brown with a soft grain.
    yy, xx = np.mgrid[0:ch, 0:cw]
    grain = (np.sin(xx / 9.0 + np.sin(yy / 140.0) * 3) * 6 + rng.normal(0, 4, (ch, cw)))
    desk = np.stack([88 + grain, 66 + grain * 0.8, 49 + grain * 0.6], axis=-1).clip(0, 255).astype(np.uint8)
    canvas = Image.fromarray(desk, "RGB")

    # Soft shadow under the page.
    shadow = mask.filter(ImageFilter.GaussianBlur(18))
    shadow = ImageChops.offset(shadow, 14, 18)
    canvas = Image.composite(Image.new("RGB", (cw, ch), (38, 28, 20)), canvas, shadow.point(lambda p: int(p * 0.55)))
    canvas.paste(warped, (0, 0), mask)

    # Uneven classroom light: brighter top-left, darker bottom-right.
    gx = (xx / cw)[..., None]
    gy = (yy / ch)[..., None]
    light = 1.05 - 0.12 * gx - 0.16 * gy - 0.06 * ((gx - 0.3) ** 2 + (gy - 0.25) ** 2)
    arr = np.asarray(canvas).astype(float) * light
    arr *= np.array([1.03, 1.0, 0.93])  # warm cast
    arr += rng.normal(0, 3.2, arr.shape)  # sensor noise
    photo = Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGB")
    photo = photo.filter(ImageFilter.GaussianBlur(0.75))
    photo = ImageEnhance.Contrast(photo).enhance(0.96)

    app = ROOT / "mobile" / "assets" / "sample"
    web = ROOT / "web" / "public" / "sample"
    app.mkdir(parents=True, exist_ok=True)
    web.mkdir(parents=True, exist_ok=True)
    photo.save(app / "handout.jpg", "JPEG", quality=84, optimize=True, progressive=True)

    small = photo.resize(WEB_SIZE, Image.LANCZOS)
    small.save(web / "handout.webp", "WEBP", quality=72, method=6)
    small.save(web / "handout.jpg", "JPEG", quality=78, optimize=True, progressive=True)

    for p in [app / "handout.jpg", web / "handout.webp", web / "handout.jpg"]:
        print(p.relative_to(ROOT), p.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
