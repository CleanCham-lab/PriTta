"""Convert pritta/web/img/<name>.png into a multi-size Windows .ico (dev-only, needs Pillow).

    python scripts/png_to_ico.py            # icon.png       -> icon.ico
    python scripts/png_to_ico.py helly-icon # helly-icon.png -> helly-icon.ico
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
name = sys.argv[1] if len(sys.argv) > 1 else "icon"
src = ROOT / "pritta" / "web" / "img" / f"{name}.png"
dst = src.with_suffix(".ico")

img = Image.open(src).convert("RGBA")
img.save(dst, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)], bitmap_format="bmp")
print(f"wrote {dst}")
