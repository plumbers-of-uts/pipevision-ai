/**
 * mask-decoder.ts — YOLO seg mask reconstruction from prototypes + coefficients.
 *
 * YOLO segmentation models emit two tensors per inference:
 *   output0  [1, 4 + nc + 32, N]   detection grid (cx,cy,w,h,class_scores,coeffs)
 *   output1  [1, 32, 160, 160]     mask prototypes shared by all detections
 *
 * To recover one detection's binary mask:
 *   1. proto_at(y,x) = vector of 32 floats         (prototype activations)
 *   2. mask_score(y,x) = sigmoid(coeffs · proto)   (32-vector dot product)
 *   3. crop to the bbox region in 160-grid coords
 *   4. resize to bbox dimensions in original image space
 *   5. threshold at 0.5
 *
 * The implementation is intentionally cache-friendly: we iterate per-pixel
 * within the bbox crop and accumulate the dot product in a single pass,
 * avoiding a 160×160 full-image allocation when only a small crop is needed.
 */

import type { LetterboxResult } from "./preprocess";

/** Shape descriptor for the prototype tensor view. */
export interface PrototypeTensor {
  /** Flat float32 data, length = channels * height * width. */
  readonly data: Float32Array;
  /** Number of prototype channels — must match coefficient length. */
  readonly channels: number;
  /** Prototype map height (typically inputSize / 4). */
  readonly height: number;
  /** Prototype map width (typically inputSize / 4). */
  readonly width: number;
}

/** Result of decoding one detection's mask. */
export interface DecodedMask {
  /** Binary mask, 1 byte per pixel (0 or 1), row-major. */
  readonly mask: Uint8Array;
  /** Output width in pixels (matches bbox.w in original image space). */
  readonly width: number;
  /** Output height in pixels (matches bbox.h in original image space). */
  readonly height: number;
}

/** Output mask threshold; pixels with sigmoid score above this are 1. */
const MASK_THRESHOLD = 0.5;

/** Numerically stable sigmoid for a single scalar. */
function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

/**
 * Decode a single detection's instance mask.
 *
 * @param coeffs       Mask coefficients for this detection (length = prototypes.channels).
 * @param prototypes   Shared mask prototype tensor.
 * @param bbox640Norm  Bounding box in normalised 640-space (cx, cy, w, h in [0, 1]).
 * @param lb           Letterbox parameters used to invert the transform.
 * @param inputSize    Square input size used during preprocessing (default 640).
 *
 * Returns the binary mask sized to the bbox in original image space, or null
 * if the bbox is degenerate (zero width / height).
 */
export function decodeMask(
  coeffs: Float32Array,
  prototypes: PrototypeTensor,
  bbox640Norm: { x: number; y: number; w: number; h: number },
  lb: LetterboxResult,
  inputSize = 640,
): DecodedMask | null {
  const { channels: ch, height: mh, width: mw, data: protoData } = prototypes;

  if (coeffs.length !== ch) {
    throw new Error(`Coefficient length ${coeffs.length} mismatches prototype channels ${ch}.`);
  }

  // Step A — bbox in 640-space pixels (cx,cy,w,h center form).
  const cx640 = bbox640Norm.x * inputSize;
  const cy640 = bbox640Norm.y * inputSize;
  const w640 = bbox640Norm.w * inputSize;
  const h640 = bbox640Norm.h * inputSize;

  // Step B — bbox in 160-grid coords (top-left x1,y1, bottom-right x2,y2).
  const grid = mw / inputSize; // 160/640 = 0.25 when defaults match.
  const x1g = Math.max(0, Math.floor((cx640 - w640 / 2) * grid));
  const y1g = Math.max(0, Math.floor((cy640 - h640 / 2) * grid));
  const x2g = Math.min(mw, Math.ceil((cx640 + w640 / 2) * grid));
  const y2g = Math.min(mh, Math.ceil((cy640 + h640 / 2) * grid));

  const cropW = Math.max(0, x2g - x1g);
  const cropH = Math.max(0, y2g - y1g);
  if (cropW === 0 || cropH === 0) return null;

  // Step C — bbox in original image space (target output size).
  const cxLb = cx640 - lb.padX;
  const cyLb = cy640 - lb.padY;
  const cxOrig = cxLb / lb.scale;
  const cyOrig = cyLb / lb.scale;
  const wOrig = w640 / lb.scale;
  const hOrig = h640 / lb.scale;

  const tlxOrig = Math.max(0, Math.round(cxOrig - wOrig / 2));
  const tlyOrig = Math.max(0, Math.round(cyOrig - hOrig / 2));
  const outW = Math.max(1, Math.min(Math.round(wOrig), lb.bitmapWidth - tlxOrig));
  const outH = Math.max(1, Math.min(Math.round(hOrig), lb.bitmapHeight - tlyOrig));

  // Step D — compute mask scores at the cropped prototype cells.
  const cropScores = new Float32Array(cropW * cropH);
  for (let cy = 0; cy < cropH; cy++) {
    const gy = y1g + cy;
    for (let cx = 0; cx < cropW; cx++) {
      const gx = x1g + cx;
      // Accumulate dot product across `ch` channels.
      let dot = 0;
      for (let c = 0; c < ch; c++) {
        const protoIdx = c * mh * mw + gy * mw + gx;
        const a = protoData[protoIdx] ?? 0;
        const b = coeffs[c] ?? 0;
        dot += a * b;
      }
      cropScores[cy * cropW + cx] = sigmoid(dot);
    }
  }

  // Step E — bilinear resize from (cropW, cropH) to (outW, outH) and threshold.
  const mask = new Uint8Array(outW * outH);
  const scaleX = (cropW - 1) / Math.max(1, outW - 1);
  const scaleY = (cropH - 1) / Math.max(1, outH - 1);

  for (let y = 0; y < outH; y++) {
    const srcY = y * scaleY;
    const y0 = Math.floor(srcY);
    const y1 = Math.min(cropH - 1, y0 + 1);
    const dy = srcY - y0;

    for (let x = 0; x < outW; x++) {
      const srcX = x * scaleX;
      const x0 = Math.floor(srcX);
      const x1 = Math.min(cropW - 1, x0 + 1);
      const dx = srcX - x0;

      const s00 = cropScores[y0 * cropW + x0] ?? 0;
      const s10 = cropScores[y0 * cropW + x1] ?? 0;
      const s01 = cropScores[y1 * cropW + x0] ?? 0;
      const s11 = cropScores[y1 * cropW + x1] ?? 0;

      const s0 = s00 * (1 - dx) + s10 * dx;
      const s1 = s01 * (1 - dx) + s11 * dx;
      const score = s0 * (1 - dy) + s1 * dy;

      mask[y * outW + x] = score >= MASK_THRESHOLD ? 1 : 0;
    }
  }

  return { mask, width: outW, height: outH };
}
