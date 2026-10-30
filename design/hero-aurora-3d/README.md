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
