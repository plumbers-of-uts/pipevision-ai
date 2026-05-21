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

import { float16ToFloat32Array, float32ToFloat16Array } from "@/lib/onnx/fp16";
import { getOrt } from "@/lib/onnx/ort-loader";
import { type PrototypeTensor, decodeMask } from "./mask-decoder";
import type { ModelConfig } from "./model-config";
import { applyNms } from "./nms";
import { decodeYoloOutput, detectLayout, unletterboxBoxes } from "./postprocess";
import { letterboxToTensor, sourceToBitmap } from "./preprocess";
import type {
  ErrorCode,
  InferenceInput,
  InferenceRawDetection,
  InferenceRawWithCoeffs,
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
  /** Model config the service is bound to. */
  readonly modelId: ModelConfig["id"];
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
  cfg: ModelConfig,
): Promise<InferenceServiceInstance> {
  if (
    serviceInstance !== null &&
    serviceInstance.backend === backend &&
    serviceInstance.modelId === cfg.id
  ) {
    return serviceInstance;
  }

  const layout = await performWarmingRun(session, cfg);
  serviceInstance = createService(session, backend, layout, cfg);
  return serviceInstance;
}

/** Clears the cached singleton (called when model is reloaded). */
export function clearInferenceService(): void {
  serviceInstance = null;
}

/**
 * Materialise the prototype tensor view from the ORT result map.
 * Expects shape [1, channels, height, width]; falls back to model-config
 * defaults if the dim list is shorter than expected.
 */
function decodeMaskPrototypes(
  results: Record<string, Tensor>,
  session: InferenceSession,
  cfg: ModelConfig,
): PrototypeTensor {
  const protoName = session.outputNames[1] ?? "output1";
  const proto = results[protoName];
  if (proto === undefined) {
    throw new InferenceError(
      `Segment model output '${protoName}' missing from session.run results.`,
      "RUNTIME",
    );
  }
  const dims = proto.dims;
  const channels = dims[1] ?? cfg.maskChannels;
  const height = dims[2] ?? cfg.maskRes;
  const width = dims[3] ?? cfg.maskRes;
  return {
    data: outputAsFloat32(proto),
    channels,
    height,
    width,
  };
}

// ─── Dtype helpers ────────────────────────────────────────────────────────────

/** Inspect inputMetadata[0].type to decide whether to feed float32 or float16. */
function resolveInputDtype(session: InferenceSession): "float32" | "float16" {
  const meta = session.inputMetadata?.[0];
  if (meta?.isTensor && meta.type === "float16") return "float16";
  return "float32";
}

/**
 * Build the input ORT Tensor in whichever dtype the model declares.
 * Source data is always produced as float32; this converts to fp16 bits
 * when needed (Uint16Array backing for ORT's fp16 type).
 */
function buildInputTensor(
  ort: Awaited<ReturnType<typeof getOrt>>,
  src: Float32Array,
  dims: readonly number[],
  dtype: "float32" | "float16",
): Tensor {
  if (dtype === "float16") {
    return new ort.Tensor("float16", float32ToFloat16Array(src), dims as number[]);
  }
  return new ort.Tensor("float32", src, dims as number[]);
}

/** Normalise an output tensor to a Float32Array regardless of declared dtype. */
function outputAsFloat32(output: Tensor): Float32Array {
  if (output.type === "float32") return output.data as Float32Array;
  if (output.type === "float16") return float16ToFloat32Array(output.data as Uint16Array);
  throw new InferenceError(
    `Unsupported output dtype '${output.type}'. Re-export with float32/float16 output.`,
    "UNSUPPORTED",
  );
}

// ─── Warming run ─────────────────────────────────────────────────────────────

async function performWarmingRun(
  session: InferenceSession,
  cfg: ModelConfig,
): Promise<OutputLayout> {
  const ort = await getOrt();
  const size = cfg.inputSize;
  const dummyData = new Float32Array(1 * 3 * size * size).fill(0.5);
  const inputDtype = resolveInputDtype(session);
  const dummyTensor = buildInputTensor(ort, dummyData, [1, 3, size, size], inputDtype);

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

  if (output.type !== "float32" && output.type !== "float16") {
    throw new InferenceError(
      `Expected float32/float16 output, got '${output.type}'. Model may need re-export.`,
      "UNSUPPORTED",
    );
  }

  // Seg models must emit a second output (prototypes) — fail loud when missing.
  if (cfg.modelTask === "segment") {
    if (session.outputNames.length < 2) {
      throw new InferenceError(
        "Segment task configured but ONNX has < 2 outputs. Re-export with task=segment.",
        "UNSUPPORTED",
      );
    }
  }

  const maskChannels = cfg.modelTask === "segment" ? cfg.maskChannels : 0;
  return detectLayout(output.dims, cfg.numClasses, maskChannels);
}

// ─── Service factory ──────────────────────────────────────────────────────────

function createService(
  session: InferenceSession,
  backend: "webgpu" | "wasm",
  layout: OutputLayout,
  cfg: ModelConfig,
): InferenceServiceInstance {
  async function run(
    input: InferenceInput,
    opts?: { signal?: AbortSignal },
  ): Promise<InferenceResult> {
    const totalStart = performance.now();

    opts?.signal?.throwIfAborted();

    // Preprocess
    const bitmap = await sourceToBitmap(input.source);
    const lb = letterboxToTensor(bitmap, cfg.inputSize);
    bitmap.close();

    opts?.signal?.throwIfAborted();

    // Build ORT tensor — convert to fp16 when the model declares fp16 input.
    const ort = await getOrt();
    const inputName = session.inputNames[0] ?? "images";
    const inputDtype = resolveInputDtype(session);
    const ortTensor = buildInputTensor(
      ort,
      lb.tensor,
      [1, 3, cfg.inputSize, cfg.inputSize],
      inputDtype,
    );

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

    // Decode output[0] = detections (+ mask coefficients when segment)
    const detName = session.outputNames[0] ?? "output0";
    const rawOutput = results[detName];
    if (rawOutput === undefined) {
      throw new InferenceError("No output tensor produced.", "RUNTIME");
    }

    const isSegment = cfg.modelTask === "segment";
    const maskChannels = isSegment ? cfg.maskChannels : 0;

    const rawData = outputAsFloat32(rawOutput);
    const decoded = decodeYoloOutput(
      { data: rawData, dims: rawOutput.dims },
      cfg.confThreshold,
      cfg.numClasses,
      layout,
      maskChannels,
      cfg.inputSize,
    );

    // Invert letterbox transform (preserves coeffs / bbox640Norm for seg)
    const unboxed = unletterboxBoxes(decoded, lb, cfg.inputSize);

    // NMS — generic over T extends InferenceRawDetection so we keep mask data
    const nmsed: InferenceRawWithCoeffs[] = applyNms(
      unboxed,
      cfg.iouThreshold,
      cfg.maxDetections,
    ) as InferenceRawWithCoeffs[];

    // Mask decode (segment only) — strip coeffs/bbox640Norm before returning.
    let maskDecodeMs = 0;
    if (isSegment) {
      const maskStart = performance.now();
      const protoTensor = decodeMaskPrototypes(results, session, cfg);

      for (const det of nmsed) {
        if (det.coeffs && det.bbox640Norm) {
          try {
            const decodedMask = decodeMask(
              det.coeffs,
              protoTensor,
              det.bbox640Norm,
              lb,
              cfg.inputSize,
            );
            if (decodedMask !== null) {
              det.mask = decodedMask.mask;
              det.maskWidth = decodedMask.width;
              det.maskHeight = decodedMask.height;
            }
          } catch (err) {
            console.warn(
              "[inference-service] mask decode failed for detection — skipping mask only:",
              err,
            );
          }
        }
        det.coeffs = undefined;
        det.bbox640Norm = undefined;
      }
      maskDecodeMs = performance.now() - maskStart;
    }

    const finalDetections: InferenceRawDetection[] = nmsed.map(
      ({ coeffs: _coeffs, bbox640Norm: _bbox640Norm, ...rest }) => rest,
    );

    const totalMs = performance.now() - totalStart;

    return {
      detections: finalDetections,
      inferenceMs,
      maskDecodeMs: isSegment ? maskDecodeMs : undefined,
      totalMs,
      backend,
    };
  }

  return { run, layout, backend, modelId: cfg.id };
}
