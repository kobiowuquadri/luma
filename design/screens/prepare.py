"""Turn real app screenshots into small WebP images for the website.

Usage:  python -I design/screens/prepare.py <folder-with-pngs> name1.png name2.png ...
Writes web/public/screens/<name>.webp at 420 px wide (about 20-40 KB each)
and prints the width/height to use in web/src/content/walkthrough.ts.
Only use screenshots taken from the real app.
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "public" / "screens"


def main():
    src = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for name in sys.argv[2:]:
        im = Image.open(src / name).convert("RGB")
        w = 420
        h = round(im.height * w / im.width)
        small = im.resize((w, h), Image.LANCZOS)
        target = OUT / (Path(name).stem + ".webp")
        small.save(target, "WEBP", quality=80, method=6)
        print(f"{target.relative_to(ROOT)}  {w}x{h}  {target.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
