"""App icons, splash and notification icon from Rantio's icon (design/brand/rantio-icon.png).

The source is the icon as drawn: a green rounded square on a white page. This script finds
the square, models its green gradient, lifts the R, house and pin off it, and writes:
  icon.png                       iOS (full square, iOS rounds the corners itself)
  android-icon-foreground.png    Android adaptive icon: R and pin inside the 66% safe zone
  android-icon-background.png    ... the green gradient
  android-icon-monochrome.png    ... themed icons (Android 13+)
  splash-icon.png                the rounded icon on the white splash screen
  notification-icon.png          Android: white on transparent
  favicon.png                    web build of the app
and the website's favicon.ico, icon.png and apple-icon.png in frontend/src/app.

In a normal terminal: cd ~/stugora/mobile && pip install numpy pillow && python3 scripts/build-icons.py
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "design" / "brand" / "rantio-icon.png"
OUT = ROOT / "mobile" / "assets" / "images"
WEB = ROOT / "frontend" / "src" / "app"

a = np.asarray(Image.open(SRC).convert("RGB")).astype(float)
H, W, _ = a.shape

# The page around the square: light grey/white pixels reached from the corners.
grey = (np.abs(a[..., 0] - a[..., 1]) < 14) & (np.abs(a[..., 1] - a[..., 2]) < 14) & (a[..., 0] > 150)
outside = np.zeros((H, W), bool)
queue = deque([(0, 0), (0, W - 1), (H - 1, 0), (H - 1, W - 1)])
for y, x in queue:
    outside[y, x] = True
while queue:
    y, x = queue.popleft()
    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
        if 0 <= ny < H and 0 <= nx < W and not outside[ny, nx] and grey[ny, nx]:
            outside[ny, nx] = True
            queue.append((ny, nx))
ys, xs = np.where(~outside)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()

# The green behind everything, as a straight gradient fitted to the clearly green pixels.
green = (a[..., 1] > a[..., 0] + 25) & (a[..., 1] < 140) & ~outside
yy, xx = np.mgrid[0:H, 0:W]
A = np.stack([np.ones(green.sum()), xx[green], yy[green]], 1)
coef = [np.linalg.lstsq(A, a[..., c][green], rcond=None)[0] for c in range(3)]
bg = np.stack([coef[c][0] + coef[c][1] * xx + coef[c][2] * yy for c in range(3)], -1)

# What sits on the green (white R and house, orange pin and windows), with soft edges.
alpha = np.clip((np.abs(a - bg).max(-1) - 18) / 200, 0, 1)
grown = np.asarray(Image.fromarray((outside * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15))) > 0
alpha[grown] = 0  # the square's light rim belongs to the page
fg = np.clip(np.where(alpha[..., None] > 0.02, (a - bg * (1 - alpha[..., None])) / np.maximum(alpha[..., None], 1e-3), 0), 0, 255)
FG = Image.fromarray(np.dstack([fg, alpha * 255]).astype(np.uint8), "RGBA")
BG = Image.fromarray(bg.clip(0, 255).astype(np.uint8)).convert("RGBA")

cx, cy, side = (x0 + x1) / 2, (y0 + y1) / 2, min(x1 - x0, y1 - y0)
box = (int(cx - side / 2), int(cy - side / 2), int(cx - side / 2) + side, int(cy - side / 2) + side)

full = BG.copy()
full.alpha_composite(FG)
full = full.crop(box).convert("RGB")

rounded = np.asarray(Image.fromarray((~outside * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2)))
tile = BG.copy()
tile.alpha_composite(FG)
tile.putalpha(Image.fromarray(rounded))
tile = tile.crop(box)


def save(img: Image.Image, path: Path, size: int) -> None:
    img.resize((size, size), Image.LANCZOS).save(path)
    print(path.relative_to(ROOT), size)


def centered(content: Image.Image, canvas: int, frac: float, color=None) -> Image.Image:
    s = frac * canvas / max(content.size)
    im = content.resize((round(content.width * s), round(content.height * s)), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.alpha_composite(im, ((canvas - im.width) // 2, (canvas - im.height) // 2))
    if color is not None:
        flat = Image.new("RGBA", (canvas, canvas), color)
        flat.putalpha(out.getchannel("A"))
        out = flat
    return out


content = FG.crop(box)
content = content.crop(content.getbbox())

save(full, OUT / "icon.png", 1024)
save(full, OUT / "favicon.png", 196)
save(tile, OUT / "splash-icon.png", 1024)
save(BG.crop(box).convert("RGB"), OUT / "android-icon-background.png", 1024)
centered(content, 1024, 0.56).save(OUT / "android-icon-foreground.png")
centered(content, 1024, 0.56, (0, 0, 0, 255)).save(OUT / "android-icon-monochrome.png")
centered(content, 96, 0.86, (255, 255, 255, 255)).save(OUT / "notification-icon.png")
save(full, WEB / "apple-icon.png", 180)
save(tile, WEB / "icon.png", 512)
tile.resize((64, 64), Image.LANCZOS).save(WEB / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("android adaptive icons, notification icon and favicon.ico written")
