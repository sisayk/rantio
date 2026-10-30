# Homepage slide: aurora cabin

An illustrated 6-second loop (2400 × 800, the homepage banner's shape): a red log cabin in the snow, northern lights moving overhead, a family of four at the grill.

- `aurora.html` — the scene, one SVG. Every animation's length divides 6 s, so the clip loops seamlessly.
- `render.js` — renders frames with Playwright.

Make the MP4 (normal terminal, in this folder):

```bash
mkdir -p frames
NODE_PATH=$(npm root -g) node render.js frames 30 6
ffmpeg -framerate 30 -i frames/f%04d.png -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -movflags +faststart -an stugora-aurora-cabin-wide.mp4
ffmpeg -i frames/f0000.png -q:v 3 stugora-aurora-cabin-wide.jpg
```

Upload both in the admin: Website → Homepage slides (Kind: Video; the JPG as its still; Focus: Right).
