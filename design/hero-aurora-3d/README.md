# Aurora cabin, 3D (Blender)

Homepage hero slide: a red log cabin in the snow, northern lights moving overhead,
a family of four grilling outside. 2400×800, 30 fps, 6 s (frames 1–180), EEVEE.

- `aurora-cabin.blend`: the scene (Blender 5.x). Render > Render Animation writes
  `stugora-aurora-cabin-3d-0001-0180.mp4` here (FFmpeg, H.264).
- The render used for the site lives in `backend/media/hero/stugora-aurora-cabin-3d.mp4`
  with its poster frame `stugora-aurora-cabin-3d.jpg`; the slide is set in the admin
  (Homepage slides), focus "right center" so the family stays in view on narrow screens.

What moves: the aurora shaders drift (Mapping location keyframes), the grill coals and
FireLight flicker, the dad turns the sausages, the girl bounces, the boy points at the
sky, and the camera pushes in slowly.

## Realistic version

`aurora-cabin-real.blend` is the photoreal take, rendered in Cycles (about 11 s a frame on the M4 Max):

- Trees: Poly Haven "Fir Sapling Medium" and "Fir Tree 01" (CC0), placed where the old cone trees stood.
- Textures: Poly Haven "Snow 02", "Weathered Peeling Timber" and "Pine Bark" (CC0), with the logs tinted falu red.
- People: generated with the MPFB add-on (MakeHuman, CC0 output) and given puffy parkas, trousers, boots,
  mittens and hats made from their own body meshes; posed and animated on the MPFB rig.

The downloaded assets sit in `assets/` (not committed, about 330 MB). To get them again, download the same
Poly Haven items at 1k (snow at 2k) into `assets/<name>/`.

`aurora-cabin-real.blend` (about 260 MB with the trees) is kept on the Mac only and is ignored by git, which cannot hold files over 100 MB on GitHub. Back it up separately.
