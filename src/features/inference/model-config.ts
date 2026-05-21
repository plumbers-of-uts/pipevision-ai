/**
 * model-config.ts — SSOT registry of ONNX models available to the app.
 *
 * The previous single-model `MODEL_CONFIG` is replaced with `MODEL_REGISTRY`,
 * a frozen map keyed by `ModelId`. The selected entry is resolved at runtime
 * by `active-model-store.ts`; consumers should call `getModelConfig(id)`
 * rather than importing a module-level singleton.
 *
 * The legacy env vars (`VITE_MODEL_URL`, `VITE_MODEL_SHA256`, `VITE_MODEL_TASK`,
 * `VITE_SPACES_URL`) still seed the `yolo26m-seg` entry so existing deploys keep
 * working. Additional models (RT-DETR, …) are declared inline below.
 */

export type ModelTask = "detect" | "segment";

export type ModelId = "yolo26m-seg" | "rt-detr";

export interface ClassMetric {
  readonly name: string;
  readonly map50: number;
}

export interface ModelSpecRow {
  readonly key: string;
  readonly val: string;
}

export interface ModelConfig {
  readonly id: ModelId;
  /** Human-readable label shown in the model selector. */
  readonly displayName: string;
  /** Short label suitable for the sidebar trigger. */
  readonly shortName: string;
  /** Full URL of the ONNX file (with a cache-busting `?v=` suffix). Empty when not yet configured. */
  readonly modelUrl: string;
  /** SHA-256 fingerprint (64 hex chars). Empty string skips the integrity check. */
  readonly sha256: string;
  /** Optional HF Spaces fallback URL (without trailing slash). */
  readonly spacesUrl: string | null;
  /** True when `modelUrl` is set — used to gate selection / show "placeholder" state. */
  readonly isConfigured: boolean;
  /** Confidence threshold — matches metadata.yaml inference.conf_threshold. */
  readonly confThreshold: number;
  /** IoU threshold — matches metadata.yaml inference.iou_threshold. */
  readonly iouThreshold: number;
  /** Max detections after NMS — matches metadata.yaml inference.max_detections. */
  readonly maxDetections: number;
  /** Number of output classes. */
  readonly numClasses: number;
  /** Input tensor spatial size (square). */
  readonly inputSize: number;
  /** Task type — "detect" for bbox-only, "segment" for bbox + mask. */
  readonly modelTask: ModelTask;
  /** Number of mask coefficient channels per detection. 0 for detect-only. */
  readonly maskChannels: number;
  /** Mask prototype resolution (square). Ignored when maskChannels === 0. */
  readonly maskRes: number;
  /** Spec rows rendered on the Models page (Architecture section). */
  readonly archSpecs: readonly ModelSpecRow[];
  /** Spec rows rendered on the Models page (Dataset section). */
  readonly datasetSpecs: readonly ModelSpecRow[];
  /** Per-class mAP@0.5 used by PerClassChart. `null` hides the chart for that model. */
  readonly classMetrics: readonly ClassMetric[] | null;
}

const envUrl = (import.meta.env.VITE_MODEL_URL ?? "") as string;
const envSha = ((import.meta.env.VITE_MODEL_SHA256 ?? "") as string).toLowerCase();
const envSpaces = import.meta.env.VITE_SPACES_URL ?? null;
const envTaskRaw = (import.meta.env.VITE_MODEL_TASK ?? "segment") as ModelTask;
const envTask: ModelTask = envTaskRaw === "detect" ? "detect" : "segment";

function appendCacheKey(url: string, hash: string): string {
  if (!url || hash.length < 8) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${hash.slice(0, 8)}`;
}

const YOLO_CLASS_METRICS: readonly ClassMetric[] = [
  { name: "Utility intrusion", map50: 0.901 },
  { name: "Hole", map50: 0.832 },
  { name: "Obstacle", map50: 0.704 },
  { name: "Debris", map50: 0.597 },
  { name: "All (avg)", map50: 0.534 },
  { name: "Crack", map50: 0.397 },
  { name: "Joint offset", map50: 0.225 },
  { name: "Buckling", map50: 0.08 },
];

const SHARED_DATASET_SPECS: readonly ModelSpecRow[] = [
  { key: "Source", val: "Roboflow Sewage Defect Detection" },
  { key: "Total images", val: "980" },
  { key: "Train split", val: "70% (686 images)" },
  { key: "Val split", val: "20% (196 images)" },
  { key: "Test split", val: "10% (98 images)" },
  { key: "Classes", val: "7 defect categories" },
  { key: "Class imbalance", val: "22.5:1 long-tail (Crack dominant)" },
  { key: "Annotation", val: "YOLO format bounding boxes" },
];

// ─── yolo26m-seg ──────────────────────────────────────────────────────────────

const yoloUrl = envUrl || "";
const yoloModelUrl = appendCacheKey(yoloUrl, envSha);

const yolo26mSeg: ModelConfig = Object.freeze({
  id: "yolo26m-seg",
  displayName: "YOLO26m-seg",
  shortName: "YOLO26m-seg",
  modelUrl: yoloModelUrl,
  sha256: envSha,
  spacesUrl: envSpaces || null,
  isConfigured: yoloModelUrl.length > 0,
  confThreshold: 0.25,
  iouThreshold: 0.45,
  maxDetections: 100,
  numClasses: 7,
  inputSize: 640,
  modelTask: envTask,
  maskChannels: envTask === "segment" ? 32 : 0,
  maskRes: envTask === "segment" ? 160 : 0,
  archSpecs: [
    { key: "Architecture", val: "YOLO26m-seg (Ultralytics)" },
    { key: "Parameters", val: "21.8M" },
    { key: "Precision", val: "FP16 ONNX" },
    { key: "Model size", val: "45 MB" },
    { key: "ONNX opset", val: "17" },
    { key: "Input size", val: "640 × 640" },
    { key: "mAP@0.5 (box)", val: "0.534 (test)" },
    { key: "mAP@0.5:0.95 (box)", val: "0.302 (test)" },
    { key: "mAP@0.5 (mask)", val: "0.475 (test)" },
    { key: "mAP@0.5:0.95 (mask)", val: "0.271 (test)" },
    { key: "Best epoch", val: "114 / 200" },
    { key: "Framework", val: "PyTorch 2.x + Ultralytics" },
  ],
  datasetSpecs: SHARED_DATASET_SPECS,
  classMetrics: YOLO_CLASS_METRICS,
} satisfies ModelConfig);

// ─── rt-detr (placeholder) ────────────────────────────────────────────────────

// TODO(oma-deferred): Replace url/sha256 once the RT-DETR export is uploaded to
// huggingface.co/gracefullight/pipevision-* and the SageMaker run publishes metrics.
const RT_DETR_URL = "";
const RT_DETR_SHA = "";

const rtDetr: ModelConfig = Object.freeze({
  id: "rt-detr",
  displayName: "RT-DETR",
  shortName: "RT-DETR",
  modelUrl: appendCacheKey(RT_DETR_URL, RT_DETR_SHA),
  sha256: RT_DETR_SHA,
  spacesUrl: null,
  isConfigured: RT_DETR_URL.length > 0,
  confThreshold: 0.25,
  iouThreshold: 0.45,
  maxDetections: 100,
  numClasses: 7,
  inputSize: 640,
  modelTask: "detect",
  maskChannels: 0,
  maskRes: 0,
  archSpecs: [
    { key: "Architecture", val: "RT-DETR (Real-Time DETR)" },
    { key: "Parameters", val: "TBD" },
    { key: "Precision", val: "FP16 ONNX" },
    { key: "Model size", val: "TBD" },
    { key: "ONNX opset", val: "17" },
    { key: "Input size", val: "640 × 640" },
    { key: "mAP@0.5 (box)", val: "TBD" },
    { key: "mAP@0.5:0.95 (box)", val: "TBD" },
    { key: "Framework", val: "PyTorch 2.x + Ultralytics" },
    { key: "Status", val: "Awaiting export upload" },
  ],
  datasetSpecs: SHARED_DATASET_SPECS,
  classMetrics: null,
} satisfies ModelConfig);

// ─── Registry ─────────────────────────────────────────────────────────────────

export const MODEL_REGISTRY: Readonly<Record<ModelId, ModelConfig>> = Object.freeze({
  "yolo26m-seg": yolo26mSeg,
  "rt-detr": rtDetr,
});

export const MODEL_IDS: readonly ModelId[] = Object.freeze(["yolo26m-seg", "rt-detr"]);

export const DEFAULT_MODEL_ID: ModelId = "yolo26m-seg";

export function isModelId(value: string): value is ModelId {
  return value in MODEL_REGISTRY;
}

export function getModelConfig(id: ModelId): ModelConfig {
  return MODEL_REGISTRY[id];
}
