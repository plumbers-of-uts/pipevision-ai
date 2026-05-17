/**
 * mask-serializer.ts — Convert binary masks between in-memory and storage forms.
 *
 * The inference pipeline produces masks as Uint8Array (1 byte/pixel; 0 or 1).
 * For persistence in Dexie we need a compact form that survives JSON round-trip
 * — PNG data URL is the natural choice because:
 *   - already supported by `<img>` and Canvas drawImage()
 *   - browser-native PNG encoder compresses 1-bit masks well
 *   - human-inspectable when copied out of devtools
 *
 * Encoding writes greyscale PNG (R=G=B=255 inside, alpha=255 inside;
 * alpha=0 outside) so it can be composited with `globalCompositeOperation`
 * to tint with class color at render time.
 */

/** Encode a binary mask to a PNG data URL using OffscreenCanvas. */
export async function encodeMaskToPng(
  mask: Uint8Array,
  width: number,
  height: number,
): Promise<string> {
  if (mask.length !== width * height) {
    throw new Error(
      `mask length ${mask.length} does not match ${width}x${height} = ${width * height}.`,
    );
  }
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("OffscreenCanvas 2D context unavailable.");

  const imageData = ctx.createImageData(width, height);
  const { data } = imageData;
  for (let i = 0; i < mask.length; i++) {
    const on = mask[i] === 1;
    const base = i * 4;
    data[base] = on ? 255 : 0;
    data[base + 1] = on ? 255 : 0;
    data[base + 2] = on ? 255 : 0;
    data[base + 3] = on ? 255 : 0;
  }
  ctx.putImageData(imageData, 0, 0);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return await blobToDataUrl(blob);
}

/** Helper — Blob → data URL via FileReader. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("FileReader produced non-string result."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Decode a mask PNG back into an HTMLImageElement suitable for Canvas drawing.
 * Returns a promise that resolves after the image has loaded.
 */
export function loadMaskPng(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load mask PNG."));
    img.src = dataUrl;
  });
}
