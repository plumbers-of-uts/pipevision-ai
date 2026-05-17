/**
 * model-config.ts — SSOT for ONNX model configuration.
 *
 * Environment variables are read at module initialization. The object is
 * frozen so accidental mutation is caught at runtime (in dev) and by TS strict.
 *
 * C2' decision: metadata.yaml is NOT fetched at runtime. This file is the TS SSOT.
 */

export type ModelTask = "detect" | "segment";

export interface ModelConfig {
  /** Full URL of the ONNX model file (HF Hub resolve URL or local path). */
  readonly modelUrl: string;
  /** SHA-256 fingerprint (64 hex chars). Empty string = skip integrity check (dev). */
  readonly sha256: string;
  /** Optional HF Spaces fallback URL (without trailing slash). */
  readonly spacesUrl: string | null;
  /** Whether modelUrl is configured (non-empty). Used for feature-flag gating. */
  readonly isConfigured: boolean;
  /** Confidence threshold — matches metadata.yaml inference.conf_threshold */
  readonly confThreshold: number;
  /** IoU threshold — matches metadata.yaml inference.iou_threshold */
  readonly iouThreshold: number;
  /** Max detections after NMS — matches metadata.yaml inference.max_detections */
  readonly maxDetections: number;
  /** Number of output classes */
  readonly numClasses: 7;
  /** Input tensor spatial size (square) */
  readonly inputSize: 640;
  /** Task type — "detect" for bbox-only, "segment" for bbox + mask. */
  readonly modelTask: ModelTask;
  /** Number of mask coefficient channels per detection. YOLO seg uses 32. */
  readonly maskChannels: 32;
  /** Mask prototype resolution (square). YOLO seg uses inputSize / 4. */
  readonly maskRes: 160;
}

const rawUrl = (import.meta.env.VITE_MODEL_URL ?? "") as string;
const sha256 = ((import.meta.env.VITE_MODEL_SHA256 ?? "") as string).toLowerCase();
const spacesUrl = import.meta.env.VITE_SPACES_URL ?? null;
const taskEnv = (import.meta.env.VITE_MODEL_TASK ?? "segment") as ModelTask;
const modelTask: ModelTask = taskEnv === "detect" ? "detect" : "segment";

function appendCacheKey(url: string, hash: string): string {
  if (!url || hash.length < 8) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${hash.slice(0, 8)}`;
}

const modelUrl = appendCacheKey(rawUrl, sha256);

export const MODEL_CONFIG: ModelConfig = Object.freeze({
  modelUrl,
  sha256: sha256 ?? "",
  spacesUrl: spacesUrl || null,
  isConfigured: typeof modelUrl === "string" && modelUrl.length > 0,
  confThreshold: 0.25,
  iouThreshold: 0.45,
  maxDetections: 100,
  numClasses: 7,
  inputSize: 640,
  modelTask,
  maskChannels: 32,
  maskRes: 160,
} satisfies ModelConfig);
