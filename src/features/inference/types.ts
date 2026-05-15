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
  /** Detected from warming run dims: [1,4+nc,N] = nc-first, [1,N,4+nc] = nc-last */
  layout: OutputLayout;
  numClasses: 7;
  /** ORT exposes float32 even for FP16 ONNX models */
  outputDtype: "float32";
  boxFormat: "xywh-center";
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
}

export interface InferenceResult {
  detections: InferenceRawDetection[];
  inferenceMs: number;
  totalMs: number;
  backend: "webgpu" | "wasm";
}

// ─── ModelContext value ───────────────────────────────────────────────────────

export interface ModelContextValue {
  status: ModelStatus;
  ensureReady: () => Promise<void>;
  retry: (opts?: { bustCache?: boolean }) => Promise<void>;
}
