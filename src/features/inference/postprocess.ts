/**
 * postprocess.ts — YOLO output decoding and coordinate restoration.
 *
 * Handles both output layouts (auto-detected from tensor dims) for both
 * detection-only (`detect` task) and instance-segmentation (`segment` task):
 *   nc-first : [1, 4+nc(+nm), N]  — e.g. [1, 11, 8400] or [1, 43, 8400]
 *   nc-last  : [1, N, 4+nc(+nm)]  — e.g. [1, 8400, 11] or [1, 8400, 43]
 *
 * Box format from YOLO: cx, cy, w, h in *normalised* 640-space [0,1].
 * After decoding we convert to pixel coords in the original image space.
 *
 * Activation: sigmoid already applied (ORT FP16 → float32 conversion keeps scores in [0,1]).
 * NaN/Inf values are filtered out silently.
 */

import type { LetterboxResult } from "./preprocess";
import type { InferenceRawDetection, InferenceRawWithCoeffs, OutputLayout } from "./types";

export interface RawTensorView {
  /** Flat float32 data from ORT output tensor. */
  data: Float32Array;
  /** Tensor dimensions, e.g. [1, 11, 8400] or [1, 8400, 11]. */
  dims: readonly number[];
}

/**
 * Detects the output layout from tensor dims.
 * Accepts both detection (4 + nc channels) and segmentation (4 + nc + nm channels) shapes.
 *
 *   nc-first: dims[1] === 4 + numClasses + maskChannels (columns = anchors)
 *   nc-last:  dims[2] === 4 + numClasses + maskChannels (rows = anchors)
 *
 * Pass maskChannels = 0 for detection-only models.
 */
export function detectLayout(
  dims: readonly number[],
  numClasses: number,
  maskChannels = 0,
): OutputLayout {
  const colsDetect = 4 + numClasses;
  const colsSegment = colsDetect + maskChannels;
  if (dims.length === 3 && (dims[1] === colsDetect || dims[1] === colsSegment)) return "nc-first";
  if (dims.length === 3 && (dims[2] === colsDetect || dims[2] === colsSegment)) return "nc-last";
  throw new Error(
    `Unexpected output dims ${JSON.stringify(dims)} for numClasses=${numClasses}, maskChannels=${maskChannels}. Expected [1, 4+nc(+nm), N] or [1, N, 4+nc(+nm)].`,
  );
}

/**
 * Decodes raw YOLO output tensor into a flat array of detections above `confThreshold`.
 *
 * Returns detections with bbox in *normalised* 640-space (cx,cy,w,h ∈ [0,1]).
 * Caller is responsible for NMS and coordinate restoration.
 *
 * When `maskChannels > 0`, each surviving detection carries a `coeffs` slice
 * (length = maskChannels) and a `bbox640Norm` mirror so the mask decoder can
 * reconstruct masks after NMS. Both fields are absent for detection-only models.
 */
export function decodeYoloOutput(
  output: RawTensorView,
  confThreshold: number,
  numClasses: number,
  layout: OutputLayout,
  maskChannels = 0,
): InferenceRawWithCoeffs[] {
  const { data, dims } = output;
  const cols = 4 + numClasses + maskChannels;

  // Number of anchor predictions
  const N = layout === "nc-first" ? (dims[2] ?? 0) : (dims[1] ?? 0);

  const detections: InferenceRawWithCoeffs[] = [];

  for (let n = 0; n < N; n++) {
    let cx: number;
    let cy: number;
    let w: number;
    let h: number;

    if (layout === "nc-first") {
      cx = data[0 * N + n] ?? 0;
      cy = data[1 * N + n] ?? 0;
      w = data[2 * N + n] ?? 0;
      h = data[3 * N + n] ?? 0;
    } else {
      cx = data[n * cols + 0] ?? 0;
      cy = data[n * cols + 1] ?? 0;
      w = data[n * cols + 2] ?? 0;
      h = data[n * cols + 3] ?? 0;
    }

    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(w) || !Number.isFinite(h))
      continue;

    // Find best class score
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

    const det: InferenceRawWithCoeffs = {
      classId: bestClassId,
      score: bestScore,
      bbox: { x: cx, y: cy, w, h }, // still normalised; unletterbox later
    };

    // Capture mask coefficients for seg models so we can decode after NMS.
    if (maskChannels > 0) {
      const coeffs = new Float32Array(maskChannels);
      for (let k = 0; k < maskChannels; k++) {
        const idx =
          layout === "nc-first" ? (4 + numClasses + k) * N + n : n * cols + 4 + numClasses + k;
        coeffs[k] = data[idx] ?? 0;
      }
      det.coeffs = coeffs;
      det.bbox640Norm = { x: cx, y: cy, w, h };
    }

    detections.push(det);
  }

  return detections;
}

/**
 * Maps decoded detections from normalised 640-space back to original image pixels.
 *
 * Input  bbox: cx, cy, w, h normalised to [0, 1] in 640×640 letterbox space.
 * Output bbox: x, y (top-left), w, h in original image pixel space.
 *
 * The function preserves any `coeffs` / `bbox640Norm` carried by the input
 * detections, so seg models can still call the mask decoder downstream.
 */
export function unletterboxBoxes<T extends InferenceRawDetection>(
  detections: T[],
  lb: LetterboxResult,
  inputSize = 640,
): T[] {
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
