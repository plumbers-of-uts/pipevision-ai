/**
 * nms.ts — Class-wise Non-Maximum Suppression.
 *
 * Algorithm:
 *   1. Group detections by classId.
 *   2. Within each class, sort by score descending.
 *   3. Greedily keep detections with IoU < iouThreshold against all already-kept boxes.
 *   4. Cap total detections at maxDetections (highest-score survivors across all classes).
 *
 * Bbox convention: top-left x, y, w, h in pixel space (output of unletterboxBoxes).
 */

import type { InferenceRawDetection } from "./types";

/** Compute intersection-over-union for two axis-aligned boxes (x,y,w,h top-left). */
function iou(a: InferenceRawDetection["bbox"], b: InferenceRawDetection["bbox"]): number {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;

  const interX = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const interY = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const intersection = interX * interY;

  if (intersection === 0) return 0;

  const unionArea = a.w * a.h + b.w * b.h - intersection;
  return unionArea > 0 ? intersection / unionArea : 0;
}

/**
 * Applies class-wise NMS and returns at most `maxDetections` survivors.
 *
 * @param detections   Raw detections (post-letterbox inversion) with top-left bbox.
 * @param iouThreshold Boxes with IoU ≥ threshold are suppressed (default 0.45).
 * @param maxDetections Hard cap on total output (default 100).
 */
export function applyNms(
  detections: InferenceRawDetection[],
  iouThreshold = 0.45,
  maxDetections = 100,
): InferenceRawDetection[] {
  if (detections.length === 0) return [];

  // Group by class
  const byClass = new Map<number, InferenceRawDetection[]>();
  for (const det of detections) {
    const group = byClass.get(det.classId);
    if (group !== undefined) {
      group.push(det);
    } else {
      byClass.set(det.classId, [det]);
    }
  }

  const survivors: InferenceRawDetection[] = [];

  for (const [, group] of byClass) {
    // Sort by score descending
    group.sort((a, b) => b.score - a.score);

    const kept: InferenceRawDetection[] = [];
    const suppressed = new Uint8Array(group.length);

    for (let i = 0; i < group.length; i++) {
      if (suppressed[i]) continue;
      const current = group[i];
      if (current === undefined) continue;
      kept.push(current);

      for (let j = i + 1; j < group.length; j++) {
        if (suppressed[j]) continue;
        const candidate = group[j];
        if (candidate === undefined) continue;
        if (iou(current.bbox, candidate.bbox) >= iouThreshold) {
          suppressed[j] = 1;
        }
      }
    }

    survivors.push(...kept);
  }

  // Sort all survivors by score descending, then cap
  survivors.sort((a, b) => b.score - a.score);
  return survivors.slice(0, maxDetections);
}
