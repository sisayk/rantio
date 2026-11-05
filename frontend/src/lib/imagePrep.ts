// Photos are made web-ready in the browser before they upload: a phone's 12 MB original
// becomes a JPEG of at most 2560 px on the long side, so uploads are quick and pages light,
// and without the camera's EXIF data (GPS position, phone, time).
// The server checks the real file type and size again; nothing here is trusted.

export const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 2560;
const QUALITY = 0.86;
export const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export type Prepared = { blob: Blob; name: string };

/** "not_image" for anything that isn't JPEG, PNG or WebP; "too_big" if it can't be brought under 8 MB. */
export async function preparePhoto(file: File): Promise<Prepared> {
  if (!ACCEPTED.includes(file.type)) throw new Error("not_image");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("not_image");
  }
  // Always drawn again, even a small photo: that drops its EXIF data, whose GPS position would
  // show where the cottage is (also when the owner hides the exact location).
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    if (file.size > MAX_BYTES) throw new Error("too_big");
    return { blob: file, name: file.name };
  }
  ctx.fillStyle = "#fff"; // transparent PNGs get a white ground as JPEGs
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) {
    if (file.size > MAX_BYTES) throw new Error("too_big");
    return { blob: file, name: file.name };
  }
  if (blob.size > MAX_BYTES) throw new Error("too_big");
  return { blob, name: file.name.replace(/\.\w+$/, "") + ".jpg" };
}
