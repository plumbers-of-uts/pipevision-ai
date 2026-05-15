/**
 * preprocess.ts — Image preprocessing for YOLO26m inference.
 *
 * Pipeline:
 *   source → ImageBitmap (EXIF-corrected, downsampled if 4K+)
 *          → letterbox to 640×640
 *          → Float32Array NCHW [1, 3, 640, 640]
 *
 * Pad value: 114/255 ≈ 0.447 (YOLO standard letterbox grey).
 * Box format out of letterbox: cx, cy, w, h in normalized 640×640 space.
 */

/** Maximum dimension before downsampling (inclusive). */
const MAX_DIM = 1280;
/** YOLO input size. */
const INPUT_SIZE = 640;
/** Letterbox pad colour in [0,1] range. */
const PAD_VALUE = 114 / 255;

/** Letterbox result used by postprocess to invert the transform. */
export interface LetterboxResult {
  /** Float32Array NCHW tensor — shape [1, 3, 640, 640]. */
  tensor: Float32Array;
  /** Uniform scale applied to both axes (original → 640 space). */
  scale: number;
  /** Horizontal padding in 640-space pixels (added equally left + right). */
  padX: number;
  /** Vertical padding in 640-space pixels (added equally top + bottom). */
  padY: number;
  /** Width of the source bitmap AFTER possible downsampling. */
  bitmapWidth: number;
  /** Height of the source bitmap AFTER possible downsampling. */
  bitmapHeight: number;
}

/**
 * Converts any supported source type to an ImageBitmap.
 *
 * - Applies EXIF orientation via `imageOrientation: 'from-image'`.
 * - Downsamples images wider or taller than MAX_DIM to fit within 1280px,
 *   preserving aspect ratio.
 */
export async function sourceToBitmap(
  source: File | Blob | ImageBitmap | HTMLImageElement | HTMLCanvasElement,
): Promise<ImageBitmap> {
  if (source instanceof ImageBitmap) return source;

  // HTMLCanvasElement can be passed directly to createImageBitmap
  if (source instanceof HTMLCanvasElement) {
    return createImageBitmap(source);
  }

  // For File/Blob we can pass directly; for HTMLImageElement we need a blob URL
  let bitmapSource: ImageBitmapSource;
  if (source instanceof HTMLImageElement) {
    const res = await fetch(source.src);
    bitmapSource = await res.blob();
  } else {
    bitmapSource = source;
  }

  // First decode without resize to get natural dimensions
  const raw = await createImageBitmap(bitmapSource, {
    imageOrientation: "from-image",
    premultiplyAlpha: "none",
    colorSpaceConversion: "default",
  });

  const { width: w, height: h } = raw;
  const needsDownsample = w > MAX_DIM || h > MAX_DIM;

  if (!needsDownsample) return raw;

  // Downsample: fit within MAX_DIM × MAX_DIM, preserving aspect ratio
  const scale = MAX_DIM / Math.max(w, h);
  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);
  raw.close();

  let bitmapSource2: ImageBitmapSource;
  if (source instanceof HTMLImageElement) {
    const res = await fetch(source.src);
    bitmapSource2 = await res.blob();
  } else {
    bitmapSource2 = source;
  }

  return createImageBitmap(bitmapSource2, {
    resizeWidth: newW,
    resizeHeight: newH,
    resizeQuality: "high",
    imageOrientation: "from-image",
    premultiplyAlpha: "none",
    colorSpaceConversion: "default",
  });
}

/**
 * Letterbox-resizes an ImageBitmap to `size × size` and returns a Float32Array
 * NCHW tensor plus the transform parameters needed to invert the letterbox.
 *
 * Channels are ordered R, G, B normalised to [0, 1].
 */
export function letterboxToTensor(bitmap: ImageBitmap, size: number = INPUT_SIZE): LetterboxResult {
  const { width: bW, height: bH } = bitmap;

  // Uniform scale to fit the longer side into `size`
  const scale = Math.min(size / bW, size / bH);
  const scaledW = Math.round(bW * scale);
  const scaledH = Math.round(bH * scale);

  // Even padding on each side
  const padX = (size - scaledW) / 2;
  const padY = (size - scaledH) / 2;

  // Draw onto an offscreen canvas
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("OffscreenCanvas 2D context unavailable");

  // Fill pad area with letterbox grey
  ctx.fillStyle = `rgb(${114},${114},${114})`;
  ctx.fillRect(0, 0, size, size);

  // Draw scaled image centred
  ctx.drawImage(bitmap, padX, padY, scaledW, scaledH);

  const imageData = ctx.getImageData(0, 0, size, size);
  const { data } = imageData; // Uint8ClampedArray, RGBA interleaved

  // Convert RGBA → NCHW Float32 [1, 3, H, W]
  const numPixels = size * size;
  const tensor = new Float32Array(3 * numPixels);

  for (let i = 0; i < numPixels; i++) {
    const base = i * 4;
    // R channel: offset 0
    tensor[i] = (data[base] ?? 0) / 255;
    // G channel: offset numPixels
    tensor[numPixels + i] = (data[base + 1] ?? 0) / 255;
    // B channel: offset 2*numPixels
    tensor[2 * numPixels + i] = (data[base + 2] ?? 0) / 255;
  }

  return { tensor, scale, padX, padY, bitmapWidth: bW, bitmapHeight: bH };
}

// Silence unused variable — PAD_VALUE is referenced here to document intent.
// The actual fill above uses the numeric literal for ctx.fillStyle compatibility.
void PAD_VALUE;
