"""Map the sample handout's visual lines onto the photographed image.

Reads handout-lines-flat.json (line rectangles measured in the flat render)
and writes web/src/content/handout.json with each line's quadrilateral in the
web image's pixel space, so the website can outline a line on the photo when
its clean text is focused.

Usage:  python -I design/sample/lines.py   (after photograph.py)
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from photograph import CANVAS, QUAD, ROOT, SRC, WEB_SIZE, perspective_coeffs  # noqa: E402
from PIL import Image  # noqa: E402


def main():
    w, h = Image.open(SRC).size
    # Forward mapping: flat page (u, v) -> photo (x, y).
    a, b, c, d, e, f, g, k = perspective_coeffs([(0, 0), (w, 0), (w, h), (0, h)], QUAD)
    sx, sy = WEB_SIZE[0] / CANVAS[0], WEB_SIZE[1] / CANVAS[1]

    def to_web(u, v):
        den = g * u + k * v + 1
        return [round((a * u + b * v + c) / den * sx, 1), round((d * u + e * v + f) / den * sy, 1)]

    blocks = json.loads((ROOT / "design" / "sample" / "handout-lines-flat.json").read_text(encoding="utf-8"))
    paragraphs, n = [], 0
    for i, blk in enumerate(blocks, start=1):
        lines = []
        for ln in blk["lines"]:
            n += 1
            x0, y0, x1, y1 = ln["box"]
            pad = 4
            x0, y0, x1, y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
            lines.append({
                "id": f"L{n}",
                "text": (blk["prefix"] if not lines else "") + ln["text"],
                "quad": [to_web(x0, y0), to_web(x1, y0), to_web(x1, y1), to_web(x0, y1)],
            })
        paragraphs.append({"id": f"P{i}", "kind": blk["kind"], "lines": lines})

    out = {
        "note": "Original sample handout written for LUMA's preview. Line positions are measured on the sample, not produced by a real scan.",
        "image": {"src": "/sample/handout.webp", "fallback": "/sample/handout.jpg", "width": WEB_SIZE[0], "height": WEB_SIZE[1]},
        "paragraphs": paragraphs,
    }
    target = ROOT / "web" / "src" / "content" / "handout.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("wrote", target.relative_to(ROOT), n, "lines")


def hero_line_crop(line_id="L23", pad=(30, 12)):
    """Crop the photographed due-date line for the website hero."""
    data = json.loads((ROOT / "web" / "src" / "content" / "handout.json").read_text(encoding="utf-8"))
    quad = next(l["quad"] for p in data["paragraphs"] for l in p["lines"] if l["id"] == line_id)
    photo = Image.open(ROOT / "mobile" / "assets" / "sample" / "handout.jpg")
    sx, sy = CANVAS[0] / WEB_SIZE[0], CANVAS[1] / WEB_SIZE[1]
    xs = [x * sx for x, _ in quad]
    ys = [y * sy for _, y in quad]
    box = (int(min(xs) - pad[0]), int(min(ys) - pad[1]), int(max(xs) + pad[0]), int(max(ys) + pad[1]))
    crop = photo.crop(box)
    web = ROOT / "web" / "public" / "sample"
    crop.save(web / "line.webp", "WEBP", quality=82, method=6)
    crop.save(web / "line.jpg", "JPEG", quality=84, optimize=True)
    print("hero line", crop.size, (web / "line.webp").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
    hero_line_crop()
