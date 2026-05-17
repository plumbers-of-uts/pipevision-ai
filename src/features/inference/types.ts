/**
 * types.ts — Shared types for the inference feature.
 *
 * These types span model config, inference I/O, and the state machine.
 * Consumers should import types only (never runtime ORT types outside ort-loader).
 */

// ─── Error codes ──────────────────────────────────────────────────────────────

export type ErrorCode = "NETWORK" | "INTEGRITY" | "UNSUPPORTED" | "SESSION_CREATE" | "RUNTIME";

// ─── Model status state machine (C5') ────────────────────────────────────────

export type ModelStatus =
  | { phase: "idle" }
  | { phase: "fetching"; loaded: number; total: number }
  | { phase: "compiling" }
  | { phase: "warming" }
  | { phase: "ready"; source: "network" | "cache"; backend: "webgpu" | "wasm" }
  | { phase: "error"; reason: string; retryable: boolean; code: ErrorCode };

// ─── Output tensor layout ─────────────────────────────────────────────────────

export type OutputLayout = "nc-first" | "nc-last";

export interface OutputContract {
  /** Detected from warming run dims: [1,4+nc(+nm),N] = nc-first, [1,N,4+nc(+nm)] = nc-last */
  layout: OutputLayout;
  numClasses: 7;
  /** ORT exposes float32 even for FP16 ONNX models */
  outputDtype: "float32";
  boxFormat: "xywh-center";
  /** True when output0 carries 32 extra mask-coefficient channels per anchor. */
  hasMaskCoeffs: boolean;
}

// ─── Inference I/O ────────────────────────────────────────────────────────────

export interface InferenceInput {
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | Blob | File;
  originalWidth?: number;
  originalHeight?: number;
}

export interface InferenceRawDetection {
  classId: number;
  score: number;
  /** Top-left xywh in original image pixel space */
  bbox: { x: number; y: number; w: number; h: number };
  /**
   * Binary mask (1 byte per pixel; 0 or 1) for this detection at bbox resolution,
   * present only when the model task is "segment" and decoding succeeded.
   */
  mask?: Uint8Array;
  /** Width of the mask buffer in pixels (matches bbox.w when present). */
  maskWidth?: number;
  /** Height of the mask buffer in pixels (matches bbox.h when present). */
  maskHeight?: number;
}

/**
 * Internal-only extension of InferenceRawDetection used between postprocess.ts
 * and inference-service.ts. The coefficient slice is needed to compute the mask
 * after NMS but is stripped before crossing the public API boundary.
 */
export interface InferenceRawWithCoeffs extends InferenceRawDetection {
  /** 32 floats per detection (mask coefficients). */
  coeffs?: Float32Array;
  /** Normalised cx,cy,w,h in 640-space — required for mask cropping. */
  bbox640Norm?: { x: number; y: number; w: number; h: number };
}

export interface InferenceResult {
  detections: InferenceRawDetection[];
  inferenceMs: number;
  /** Wall-clock time spent decoding masks (0 when modelTask === "detect"). */
  maskDecodeMs?: number;
  totalMs: number;
  backend: "webgpu" | "wasm";
}

// ─── ModelContext value ───────────────────────────────────────────────────────

export interface ModelContextValue {
  status: ModelStatus;
  ensureReady: () => Promise<void>;
  retry: (opts?: { bustCache?: boolean }) => Promise<void>;
}
