"""App icons, splash and notification icon from Stugora's mark (the website's Logo).

In a normal terminal: cd ~/stugora/mobile && pip install cairosvg pillow && python3 scripts/build-icons.py
"""
import io
from pathlib import Path

import cairosvg
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "assets" / "images"
GREEN = "#1d4c3c"
MARK = """
<path d="M15 4 6 17h4.5L5 25h20l-5.5-8H24L15 4Z" fill="{c}"/>
<path d="M14 25v4h2v-4" fill="{c}"/>
<path d="M21 25V17l6.5-5 6.5 5v8" fill="none" stroke="{c}" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M3 31c2.5-1.6 5-1.6 7.5 0s5 1.6 7.5 0 5-1.6 7.5 0 5 1.6 7.5 0 3.5-1.6 4 0M7 35.5c2-1.2 4-1.2 6 0s4 1.2 6 0 4-1.2 6 0 4 1.2 6 0" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round"/>
"""


def svg(size: int, color: str, scale: float, background: str | None = None) -> bytes:
    """The 40×40 mark centred on a square canvas, taking `scale` of its width."""
    s = size * scale / 40
    off = (size - 40 * s) / 2
    bg = f'<rect width="{size}" height="{size}" fill="{background}"/>' if background else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}">{bg}<g transform="translate({off} {off}) scale({s})">{MARK.format(c=color)}</g></svg>'.encode()


def png(name: str, data: bytes, size: int) -> None:
    img = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=data, output_width=size, output_height=size)))
    img.save(OUT / name)
    print(name, img.size)


png("icon.png", svg(1024, "#ffffff", 0.62, GREEN), 1024)  # iOS: no transparency, iOS rounds the corners
png("android-icon-foreground.png", svg(1024, "#ffffff", 0.42), 1024)  # inside Android's 66% safe zone
png("android-icon-background.png", svg(1024, GREEN, 0, GREEN), 1024)
png("android-icon-monochrome.png", svg(1024, "#000000", 0.42), 1024)
png("splash-icon.png", svg(1024, GREEN, 0.9), 1024)
png("notification-icon.png", svg(96, "#ffffff", 0.8), 96)  # Android: white on transparent
png("favicon.png", svg(196, "#ffffff", 0.62, GREEN), 196)
