/**
 * postprocess.ts — YOLO output decoding and coordinate restoration.
 *
 * Handles three output layouts (auto-detected from tensor dims) across the
 * `detect` and `segment` tasks:
 *   nc-first      : [1, 4+nc(+nm), N]   raw YOLO head, channels-first
 *   nc-last       : [1, N, 4+nc(+nm)]   raw YOLO head, channels-last
 *   nms-included  : [1, max_det, 6(+nm)] end2end export (xyxy,conf,cls,coeffs)
 *
 * Raw layouts give cx,cy,w,h in *normalised* 640-space [0,1]; the NMS-included
 * layout emits xyxy in 640-pixel space and we convert to normalised cx/cy/w/h
 * here so the downstream `unletterboxBoxes` path stays unchanged.
 *
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
 *
 *   nc-first      : dims[1] === 4 + numClasses (+maskChannels)
 *   nc-last       : dims[2] === 4 + numClasses (+maskChannels)
 *   nms-included  : dims[2] === 6 + maskChannels   (xyxy + conf + cls + coeffs)
 *
 * Pass maskChannels = 0 for detection-only models.
 */
export function detectLayout(
  dims: readonly number[],
  numClasses: number,
  maskChannels = 0,
): OutputLayout {
  if (dims.length !== 3) {
    throw new Error(
      `Unexpected output dims ${JSON.stringify(dims)} — need a 3D tensor for YOLO output.`,
    );
  }
  const colsDetect = 4 + numClasses;
  const colsSegment = colsDetect + maskChannels;
  const colsNms = 6 + maskChannels;
  if (dims[1] === colsDetect || dims[1] === colsSegment) return "nc-first";
  if (dims[2] === colsDetect || dims[2] === colsSegment) return "nc-last";
  if (dims[2] === colsNms || dims[2] === 6) return "nms-included";
  throw new Error(
    `Unexpected output dims ${JSON.stringify(dims)} for numClasses=${numClasses}, maskChannels=${maskChannels}. Expected [1, 4+nc(+nm), N], [1, N, 4+nc(+nm)], or [1, max_det, 6(+nm)].`,
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
  inputSize = 640,
): InferenceRawWithCoeffs[] {
  if (layout === "nms-included") {
    return decodeNmsIncludedOutput(output, confThreshold, maskChannels, inputSize);
  }

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
 * Decode an end-to-end (NMS-included) YOLO seg export.
 *
 *   dims: [1, max_det, 6 + maskChannels]
 *   columns per row: [x1, y1, x2, y2, conf, classId, ...maskCoeffs]
 *   coordinates are pixel-space in the model input (inputSize × inputSize).
 *
 * Padding rows beyond actual detections carry conf=0 and are dropped by the
 * threshold check. The output bbox is converted to normalised cx/cy/w/h so the
 * existing `unletterboxBoxes` path applies without modification.
 */
function decodeNmsIncludedOutput(
  output: RawTensorView,
  confThreshold: number,
  maskChannels: number,
  inputSize: number,
): InferenceRawWithCoeffs[] {
  const { data, dims } = output;
  const maxDet = dims[1] ?? 0;
  const cols = 6 + maskChannels;
  const detections: InferenceRawWithCoeffs[] = [];

  for (let i = 0; i < maxDet; i++) {
    const base = i * cols;
    const x1 = data[base] ?? 0;
    const y1 = data[base + 1] ?? 0;
    const x2 = data[base + 2] ?? 0;
    const y2 = data[base + 3] ?? 0;
    const conf = data[base + 4] ?? 0;
    const clsRaw = data[base + 5] ?? 0;

    if (!Number.isFinite(conf) || conf < confThreshold) continue;
    if (!Number.isFinite(x1) || !Number.isFinite(y1)) continue;
    if (!Number.isFinite(x2) || !Number.isFinite(y2)) continue;

    const cx = (x1 + x2) / 2 / inputSize;
    const cy = (y1 + y2) / 2 / inputSize;
    const w = (x2 - x1) / inputSize;
    const h = (y2 - y1) / inputSize;
    if (w <= 0 || h <= 0) continue;

    const det: InferenceRawWithCoeffs = {
      classId: Math.max(0, Math.round(clsRaw)),
      score: conf,
      bbox: { x: cx, y: cy, w, h },
    };

    if (maskChannels > 0) {
      const coeffs = new Float32Array(maskChannels);
      for (let k = 0; k < maskChannels; k++) {
        coeffs[k] = data[base + 6 + k] ?? 0;
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
