/**
 * postprocess.ts — YOLO output decoding and coordinate restoration.
 *
 * Handles both output layouts (auto-detected from tensor dims):
 *   nc-first : [1, 4+nc, N]  — e.g. [1, 11, 8400]
 *   nc-last  : [1, N, 4+nc]  — e.g. [1, 8400, 11]
 *
 * Box format from YOLO: cx, cy, w, h in *normalised* 640-space [0,1].
 * After decoding we convert to pixel coords in the original image space.
 *
 * Activation: sigmoid already applied (ORT FP16 → float32 conversion keeps scores in [0,1]).
 * NaN/Inf values are filtered out silently.
 */

import type { LetterboxResult } from "./preprocess";
import type { InferenceRawDetection, OutputLayout } from "./types";

export interface RawTensorView {
  /** Flat float32 data from ORT output tensor. */
  data: Float32Array;
  /** Tensor dimensions, e.g. [1, 11, 8400] or [1, 8400, 11]. */
  dims: readonly number[];
}

/**
 * Detects the output layout from tensor dims.
 * nc-first: dims[1] === 4 + numClasses (columns = anchors)
 * nc-last:  dims[2] === 4 + numClasses (rows = anchors)
 */
export function detectLayout(dims: readonly number[], numClasses: number): OutputLayout {
  const cols = 4 + numClasses;
  if (dims.length === 3 && dims[1] === cols) return "nc-first";
  if (dims.length === 3 && dims[2] === cols) return "nc-last";
  throw new Error(
    `Unexpected output dims ${JSON.stringify(dims)} for numClasses=${numClasses}. Expected [1, 4+nc, N] or [1, N, 4+nc].`,
  );
}

/**
 * Decodes raw YOLO output tensor into a flat array of detections above `confThreshold`.
 *
 * Returns detections with bbox in *normalised* 640-space (cx,cy,w,h ∈ [0,1]).
 * Caller is responsible for NMS and coordinate restoration.
 */
export function decodeYoloOutput(
  output: RawTensorView,
  confThreshold: number,
  numClasses: number,
  layout: OutputLayout,
): InferenceRawDetection[] {
  const { data, dims } = output;
  const cols = 4 + numClasses;

  // Number of anchor predictions
  const N = layout === "nc-first" ? (dims[2] ?? 0) : (dims[1] ?? 0);

  const detections: InferenceRawDetection[] = [];

  for (let n = 0; n < N; n++) {
    let cx: number;
    let cy: number;
    let w: number;
    let h: number;

    if (layout === "nc-first") {
      // data shape: [4+nc, N] → index = channelIndex * N + anchorIndex
      cx = data[0 * N + n] ?? 0;
      cy = data[1 * N + n] ?? 0;
      w = data[2 * N + n] ?? 0;
      h = data[3 * N + n] ?? 0;
    } else {
      // data shape: [N, 4+nc] → index = anchorIndex * cols + channelIndex
      cx = data[n * cols + 0] ?? 0;
      cy = data[n * cols + 1] ?? 0;
      w = data[n * cols + 2] ?? 0;
      h = data[n * cols + 3] ?? 0;
    }

    // Filter NaN / Inf coords
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(w) || !Number.isFinite(h))
      continue;

    // Find best class
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestClassId = 0;
    for (let c = 0; c < numClasses; c++) {
      const score =
        layout === "nc-first" ? (data[(4 + c) * N + n] ?? 0) : (data[n * cols + 4 + c] ?? 0);
      if (!Number.isFinite(score)) continue;
      if (score > bestScore) {
        bestScore = score;
        bestClassId = c;
      }
    }

    if (bestScore < confThreshold) continue;

    // YOLO box: cx,cy,w,h normalised to [0,1] in the 640×640 input space
    detections.push({
      classId: bestClassId,
      score: bestScore,
      bbox: { x: cx, y: cy, w, h }, // still normalised; unletterbox later
    });
  }

  return detections;
}

/**
 * Maps decoded detections from normalised 640-space back to original image pixels.
 *
 * Input  bbox: cx, cy, w, h normalised to [0, 1] in 640×640 letterbox space.
 * Output bbox: x, y (top-left), w, h in original image pixel space.
 */
export function unletterboxBoxes(
  detections: InferenceRawDetection[],
  lb: LetterboxResult,
  inputSize = 640,
): InferenceRawDetection[] {
  const { scale, padX, padY, bitmapWidth, bitmapHeight } = lb;

  return detections.map((det) => {
    const { x: cxN, y: cyN, w: wN, h: hN } = det.bbox;

    // From normalised [0,1] to 640-space pixels
    const cx640 = cxN * inputSize;
    const cy640 = cyN * inputSize;
    const w640 = wN * inputSize;
    const h640 = hN * inputSize;

    // Remove letterbox padding
    const cxScaled = cx640 - padX;
    const cyScaled = cy640 - padY;

    // Reverse the uniform scale to original bitmap space
    const cxOrig = cxScaled / scale;
    const cyOrig = cyScaled / scale;
    const wOrig = w640 / scale;
    const hOrig = h640 / scale;

    // Convert cx/cy/w/h → top-left x/y/w/h, clamp to image bounds
    const x = Math.max(0, Math.round(cxOrig - wOrig / 2));
    const y = Math.max(0, Math.round(cyOrig - hOrig / 2));
    const bw = Math.min(Math.round(wOrig), bitmapWidth - x);
    const bh = Math.min(Math.round(hOrig), bitmapHeight - y);

    return { ...det, bbox: { x, y, w: bw, h: bh } };
  });
}
