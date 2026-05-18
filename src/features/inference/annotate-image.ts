/**
 * annotate-image.ts — Off-DOM compositor that bakes detection overlays
 * (masks + bboxes + labels) onto the source image at full resolution.
 *
 * Output is a WebP data URL suitable for persisting as HistoryRecord.thumbnailDataUrl,
 * so the history thumbnail and detail modal show the segmented view rather than the
 * raw input. Rendering mirrors DetectionCanvas so the saved image matches what the
 * user saw in the Results panel.
 */

import type { Detection } from "@/features/history-store/types";

const MASK_ALPHA = 0.45;
const DEFAULT_QUALITY = 0.92;

interface AnnotateOptions {
  /** WebP quality, 0..1. Default 0.92. */
  quality?: number;
  /** Override font scale for labels. 1 = auto-scale by image size. */
  fontScale?: number;
}

type CanvasLike = HTMLCanvasElement | OffscreenCanvas;

function createCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToWebpDataUrl(canvas: CanvasLike, quality: number): Promise<string> {
  if (canvas instanceof HTMLCanvasElement) {
    return canvas.toDataURL("image/webp", quality);
  }
  const blob = await canvas.convertToBlob({ type: "image/webp", quality });
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

async function loadMask(maskPng: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(maskPng);
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

/**
 * Compose the inspection image with detection overlays and return a WebP data URL.
 *
 * @param source        Source image as Blob (uploaded file or fetched sample).
 * @param detections    NMS-filtered detections with optional maskPng.
 * @param options       Optional encoder/render tuning.
 * @returns WebP data URL at the source image's native resolution.
 */
export async function composeAnnotatedImage(
  source: Blob,
  detections: Detection[],
  options: AnnotateOptions = {},
): Promise<string> {
  const quality = options.quality ?? DEFAULT_QUALITY;

  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  const { width, height } = bitmap;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) {
    bitmap.close();
    throw new Error("composeAnnotatedImage: 2D context unavailable");
  }

  // Layer 1 — original image at native resolution.
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Layer 2 — masks (tinted with class color via source-in compositing).
  const maskImages = await Promise.all(
    detections.map((det) => (det.maskPng ? loadMask(det.maskPng) : Promise.resolve(null))),
  );

  for (let i = 0; i < detections.length; i++) {
    const det = detections[i];
    if (det === undefined) continue;
    const maskImg = maskImages[i];
    if (!maskImg) continue;
    const { x, y, w, h } = det.bbox;

    const off = createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    const offCtx = off.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!offCtx) {
      maskImg.close();
      continue;
    }
    offCtx.drawImage(maskImg, 0, 0, off.width, off.height);
    offCtx.globalCompositeOperation = "source-in";
    offCtx.fillStyle = det.color;
    offCtx.fillRect(0, 0, off.width, off.height);
    maskImg.close();

    ctx.save();
    ctx.globalAlpha = MASK_ALPHA;
    ctx.drawImage(off, x, y, w, h);
    ctx.restore();
  }

  // Auto-scale stroke/label sizes to keep them readable on large source images.
  const baseDim = Math.max(width, height);
  const strokeWidth = Math.max(2, Math.round(baseDim * 0.003));
  const fontPx = Math.max(11, Math.round(baseDim * 0.018 * (options.fontScale ?? 1)));
  const labelPadX = Math.round(fontPx * 0.45);
  const labelPadY = Math.round(fontPx * 0.25);
  const cornerR = Math.max(3, Math.round(strokeWidth * 1.5));

  // Layer 3 + 4 — bbox stroke + label pill + label text.
  for (const det of detections) {
    const { x, y, w, h } = det.bbox;

    ctx.save();
    ctx.strokeStyle = det.color;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(x + cornerR, y);
    ctx.lineTo(x + w - cornerR, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + cornerR);
    ctx.lineTo(x + w, y + h - cornerR);
    ctx.quadraticCurveTo(x + w, y + h, x + w - cornerR, y + h);
    ctx.lineTo(x + cornerR, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - cornerR);
    ctx.lineTo(x, y + cornerR);
    ctx.quadraticCurveTo(x, y, x + cornerR, y);
    ctx.closePath();
    ctx.stroke();

    const label = `${det.className} ${(det.confidence * 100).toFixed(0)}%`;
    ctx.font = `bold ${fontPx}px 'SF Mono', 'JetBrains Mono', ui-monospace, monospace`;
    const textW = ctx.measureText(label).width;
    const labelH = fontPx + labelPadY * 2;
    const labelY = y > labelH + 2 ? y - labelH - 2 : y + 2;

    ctx.fillStyle = det.color;
    ctx.beginPath();
    ctx.roundRect(x - 1, labelY, textW + labelPadX * 2, labelH, cornerR);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + labelPadX, labelY + labelH / 2);
    ctx.restore();
  }

  return canvasToWebpDataUrl(canvas, quality);
}
