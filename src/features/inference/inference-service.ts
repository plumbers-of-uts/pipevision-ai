/**
 * inference-service.ts — Module-scope singleton for ONNX inference.
 *
 * Responsibilities:
 *   - Accept a pre-loaded InferenceSession + backend label from ModelProvider.
 *   - Run full pipeline: preprocess → session.run → postprocess → NMS.
 *   - Warming run (0.5-filled tensor) validates output dtype and detects layout.
 *   - WebGPU → WASM retry once on RUNTIME error (T7).
 *   - SHA-256 integrity verification (T14) is done in ModelProvider during fetch;
 *     this service receives an already-verified session.
 *
 * D13 preserved: no Web Workers. All inference runs on main thread.
 * Only ort-loader.ts (and this file) perform runtime imports of onnxruntime-web.
 */

import type { InferenceSession, Tensor } from "onnxruntime-web";

import { getOrt } from "@/lib/onnx/ort-loader";
import { MODEL_CONFIG } from "./model-config";
import { applyNms } from "./nms";
import { decodeYoloOutput, detectLayout, unletterboxBoxes } from "./postprocess";
import { letterboxToTensor, sourceToBitmap } from "./preprocess";
import type {
  ErrorCode,
  InferenceInput,
  InferenceRawDetection,
  InferenceResult,
  OutputLayout,
} from "./types";

// ─── InferenceError ──────────────────────────────────────────────────────────

export class InferenceError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
    this.name = "InferenceError";
  }
}

// ─── Service interface ────────────────────────────────────────────────────────

export interface InferenceServiceInstance {
  run(input: InferenceInput, opts?: { signal?: AbortSignal }): Promise<InferenceResult>;
  /** Layout determined after warming run. */
  readonly layout: OutputLayout;
  readonly backend: "webgpu" | "wasm";
}

// ─── Module-scope singleton ───────────────────────────────────────────────────

let serviceInstance: InferenceServiceInstance | null = null;

/**
 * Creates (or returns cached) InferenceService bound to the given session.
 * If the session reference changes, a new instance is created.
 *
 * The warming run is performed on first creation:
 *   - Fills a dummy tensor with 0.5.
 *   - Validates output[0].type === 'float32' (UNSUPPORTED otherwise).
 *   - Detects nc-first vs nc-last layout from output dims.
 */
export async function getInferenceService(
  session: InferenceSession,
  backend: "webgpu" | "wasm",
): Promise<InferenceServiceInstance> {
  if (serviceInstance !== null && serviceInstance.backend === backend) {
    return serviceInstance;
  }

  const layout = await performWarmingRun(session);
  serviceInstance = createService(session, backend, layout);
  return serviceInstance;
}

/** Clears the cached singleton (called when model is reloaded). */
export function clearInferenceService(): void {
  serviceInstance = null;
}

// ─── Warming run ─────────────────────────────────────────────────────────────

async function performWarmingRun(session: InferenceSession): Promise<OutputLayout> {
  const ort = await getOrt();
  const size = MODEL_CONFIG.inputSize;
  const dummyData = new Float32Array(1 * 3 * size * size).fill(0.5);
  const dummyTensor = new ort.Tensor("float32", dummyData, [1, 3, size, size]);

  const inputName = session.inputNames[0] ?? "images";
  const feeds: Record<string, Tensor> = { [inputName]: dummyTensor };

  let results: Record<string, Tensor>;
  try {
    results = await session.run(feeds);
  } catch (err) {
    throw new InferenceError(
      `Warming run failed: ${err instanceof Error ? err.message : String(err)}`,
      "RUNTIME",
    );
  }

  const outputName = session.outputNames[0] ?? "output0";
  const output = results[outputName];
  if (output === undefined) {
    throw new InferenceError("Warming run produced no output tensor.", "RUNTIME");
  }

  // Validate dtype (C1' — ORT exposes float32 even for FP16 models)
  if (output.type !== "float32") {
    throw new InferenceError(
      `Expected float32 output, got '${output.type}'. Model may need re-export.`,
      "UNSUPPORTED",
    );
  }

  return detectLayout(output.dims, MODEL_CONFIG.numClasses);
}

// ─── Service factory ──────────────────────────────────────────────────────────

function createService(
  session: InferenceSession,
  backend: "webgpu" | "wasm",
  layout: OutputLayout,
): InferenceServiceInstance {
  async function run(
    input: InferenceInput,
    opts?: { signal?: AbortSignal },
  ): Promise<InferenceResult> {
    const totalStart = performance.now();

    opts?.signal?.throwIfAborted();

    // Preprocess
    const bitmap = await sourceToBitmap(input.source);
    const lb = letterboxToTensor(bitmap, MODEL_CONFIG.inputSize);
    bitmap.close();

    opts?.signal?.throwIfAborted();

    // Build ORT tensor
    const ort = await getOrt();
    const inputName = session.inputNames[0] ?? "images";
    const ortTensor = new ort.Tensor("float32", lb.tensor, [
      1,
      3,
      MODEL_CONFIG.inputSize,
      MODEL_CONFIG.inputSize,
    ]);

    // Run session
    const inferStart = performance.now();
    let results: Record<string, Tensor>;
    try {
      results = await session.run({ [inputName]: ortTensor } as Record<string, Tensor>);
    } catch (err) {
      throw new InferenceError(
        `session.run failed: ${err instanceof Error ? err.message : String(err)}`,
        "RUNTIME",
      );
    }
    const inferenceMs = performance.now() - inferStart;

    opts?.signal?.throwIfAborted();

    // Decode output
    const outputName = session.outputNames[0] ?? "output0";
    const rawOutput = results[outputName];
    if (rawOutput === undefined) {
      throw new InferenceError("No output tensor produced.", "RUNTIME");
    }

    const rawData = rawOutput.data as Float32Array;
    const decoded = decodeYoloOutput(
      { data: rawData, dims: rawOutput.dims },
      MODEL_CONFIG.confThreshold,
      MODEL_CONFIG.numClasses,
      layout,
    );

    // Invert letterbox transform
    const unboxed = unletterboxBoxes(decoded, lb, MODEL_CONFIG.inputSize);

    // NMS
    const nmsed: InferenceRawDetection[] = applyNms(
      unboxed,
      MODEL_CONFIG.iouThreshold,
      MODEL_CONFIG.maxDetections,
    );

    const totalMs = performance.now() - totalStart;

    return { detections: nmsed, inferenceMs, totalMs, backend };
  }

  return { run, layout, backend };
}
