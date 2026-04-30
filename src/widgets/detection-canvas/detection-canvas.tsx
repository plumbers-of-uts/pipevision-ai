/**
 * detection-canvas.tsx — Canvas overlay rendering image + bounding boxes.
 * Draws each detection bbox with rounded corners, class label and confidence.
 * Color sourced from PIPEVISION_CLASSES[classId].color (HSL string).
 *
 * Props:
 *   imageUrl   — object URL or data URL of the inspection image
 *   detections — array of Detection from the mock inference result
 *   imgWidth   — original image width (px) used for bbox coordinate scaling
 *   imgHeight  — original image height (px)
 */

"use client";

import { useEffect, useRef } from "react";

import type { Detection } from "@/features/history-store/types";

interface DetectionCanvasProps {
  imageUrl: string;
  detections: Detection[];
  imgWidth: number;
  imgHeight: number;
  className?: string;
}

export function DetectionCanvas({
  imageUrl,
  detections,
  imgWidth,
  imgHeight,
  className,
}: DetectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Match canvas intrinsic size to displayed size for crisp rendering
      const displayW = canvas.offsetWidth;
      const displayH = canvas.offsetHeight;
      canvas.width = displayW * window.devicePixelRatio;
      canvas.height = displayH * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Draw image stretched to fill canvas
      ctx.drawImage(img, 0, 0, displayW, displayH);

      // Scale factors from original image coords to display coords
      const scaleX = displayW / imgWidth;
      const scaleY = displayH / imgHeight;

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
    img.src = imageUrl;
  }, [imageUrl, detections, imgWidth, imgHeight]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-label={`Detection canvas with ${detections.length} detected defect${detections.length !== 1 ? "s" : ""}`}
    />
  );
}
