/**
 * detection-canvas.tsx — Canvas overlay rendering image + bounding boxes + masks.
 *
 * Layer order (back → front):
 *   1. inspection image stretched to canvas size
 *   2. semi-transparent instance masks tinted with each detection's class color
 *      (only drawn when det.maskPng is present)
 *   3. bbox stroke
 *   4. label pill
 *
 * Props:
 *   imageUrl   — object URL or data URL of the inspection image
 *   detections — array of Detection from inference or persisted history
 *   imgWidth   — original image width (px) used for coordinate scaling
 *   imgHeight  — original image height (px)
 *   showMasks  — when false, the mask layer is skipped (bbox-only view)
 */

import { useEffect, useRef } from "react";

import type { Detection } from "@/features/history-store/types";

/** Alpha applied to mask fills (0..1) — tuned for legibility over bright images. */
const MASK_ALPHA = 0.45;

interface DetectionCanvasProps {
  imageUrl: string;
  detections: Detection[];
  imgWidth: number;
  imgHeight: number;
  className?: string;
  showMasks?: boolean;
}

export function DetectionCanvas({
  imageUrl,
  detections,
  imgWidth,
  imgHeight,
  className,
  showMasks = true,
}: DetectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;

    // Pre-load all mask PNGs in parallel — eliminates draw-order flicker.
    const maskLoads = showMasks
      ? Promise.all(
          detections.map(async (det) => {
            if (!det.maskPng) return null;
            const maskImg = new Image();
            return new Promise<HTMLImageElement | null>((resolve) => {
              maskImg.onload = () => resolve(maskImg);
              maskImg.onerror = () => resolve(null);
              maskImg.src = det.maskPng ?? "";
            });
          }),
        )
      : Promise.resolve<Array<HTMLImageElement | null>>([]);

    const img = new Image();
    img.onload = async () => {
      if (cancelled) return;
      const displayW = canvas.offsetWidth;
      const displayH = canvas.offsetHeight;
      canvas.width = displayW * window.devicePixelRatio;
      canvas.height = displayH * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      ctx.drawImage(img, 0, 0, displayW, displayH);

      const scaleX = displayW / imgWidth;
      const scaleY = displayH / imgHeight;

      // Layer 2 — masks (only when showMasks and PNG available).
      const maskImages = await maskLoads;
      if (cancelled) return;

      for (let i = 0; i < detections.length; i++) {
        const det = detections[i];
        if (det === undefined) continue;
        const maskImg = maskImages[i];
        if (!maskImg) continue;
        const x = det.bbox.x * scaleX;
        const y = det.bbox.y * scaleY;
        const w = det.bbox.w * scaleX;
        const h = det.bbox.h * scaleY;

        // Tint trick:
        //   1. draw the white mask PNG into an offscreen canvas
        //   2. set composite mode to "source-in" → fills only mask pixels
        //   3. fill rect with class color
        const off = document.createElement("canvas");
        off.width = Math.max(1, Math.round(w));
        off.height = Math.max(1, Math.round(h));
        const offCtx = off.getContext("2d");
        if (offCtx === null) continue;
        offCtx.drawImage(maskImg, 0, 0, off.width, off.height);
        offCtx.globalCompositeOperation = "source-in";
        offCtx.fillStyle = det.color;
        offCtx.fillRect(0, 0, off.width, off.height);

        ctx.save();
        ctx.globalAlpha = MASK_ALPHA;
        ctx.drawImage(off, x, y, w, h);
        ctx.restore();
      }

      // Layer 3 + 4 — bbox + label, same as before.
      for (const det of detections) {
        const x = det.bbox.x * scaleX;
        const y = det.bbox.y * scaleY;
        const w = det.bbox.w * scaleX;
        const h = det.bbox.h * scaleY;

        // Bounding box
        ctx.save();
        ctx.strokeStyle = det.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const r = 3;
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.stroke();

        // Label background
        const label = `${det.className} ${(det.confidence * 100).toFixed(0)}%`;
        ctx.font = "bold 11px 'SF Mono', 'JetBrains Mono', monospace";
        const textW = ctx.measureText(label).width;
        const labelH = 18;
        const labelY = y > labelH + 2 ? y - labelH - 2 : y + 2;
        ctx.fillStyle = det.color;
        ctx.beginPath();
        ctx.roundRect(x - 1, labelY, textW + 10, labelH, 3);
        ctx.fill();

        // Label text
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x + 4, labelY + labelH / 2);
        ctx.restore();
      }
    };
    img.onerror = () => {
      // Swallow load failures — caller handles the missing-image case visually.
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, detections, imgWidth, imgHeight, showMasks]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-label={`Detection canvas with ${detections.length} detected defect${detections.length !== 1 ? "s" : ""}`}
    />
  );
}
