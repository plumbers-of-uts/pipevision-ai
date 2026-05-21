/**
 * fallback-spaces.ts — HF Spaces Gradio fallback for when local ONNX inference fails.
 *
 * Endpoint: POST ${VITE_SPACES_URL}/run/predict
 * Request:  { data: [imageDataUrl, conf, iou] }
 * Response: { data: [resultImageDataUrl, { detections, inference_ms, model_version }] }
 *   — data[1] is the JSON detections per C6' (Option A — server returns structured detections)
 *
 * The fallback button is only shown when VITE_SPACES_URL is configured.
 * This is a user-triggered action (D-H decision), never automatic.
 *
 * Timeout: 60 seconds (Spaces cold-start can take ~30s).
 */

import { v4 as uuidv4 } from "uuid";

import { CLASS_BY_ID } from "@/features/history-store/classes";
import type { Detection } from "@/features/history-store/types";
import { getActiveModelId } from "./active-model-store";
import { getModelConfig } from "./model-config";
import type { ErrorCode } from "./types";

// ─── Response shape from Spaces (C6' Option A) ───────────────────────────────

interface SpacesDetection {
  class_id: number;
  score: number;
  /** [x, y, w, h] in original image pixels, top-left origin (per Spaces app spec) */
  bbox: [number, number, number, number];
}

interface SpacesJsonOutput {
  detections: SpacesDetection[];
  inference_ms: number;
  model_version?: string;
}

interface SpacesResponse {
  data: [string, SpacesJsonOutput];
  duration?: number;
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class SpacesFallbackError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
    this.name = "SpacesFallbackError";
  }
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

/** Map Spaces response detections to the local Detection contract (C3). */
function adaptSpacesDetections(spacesDetections: SpacesDetection[]): Detection[] {
  return spacesDetections.map((sd) => {
    const meta = CLASS_BY_ID[sd.class_id];
    const [x, y, w, h] = sd.bbox;
    return {
      id: uuidv4(),
      classId: sd.class_id,
      className: meta?.name ?? `Class ${sd.class_id}`,
      severity: meta?.severity ?? "low",
      confidence: sd.score,
      bbox: { x: x ?? 0, y: y ?? 0, w: w ?? 0, h: h ?? 0 },
      color: meta?.color ?? "#888888",
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true when the Spaces fallback is available (URL is configured for the active model). */
export function isSpacesFallbackAvailable(): boolean {
  const cfg = getModelConfig(getActiveModelId());
  return cfg.spacesUrl !== null && cfg.spacesUrl.length > 0;
}

/**
 * Run inference on HF Spaces and return detections in local Detection format.
 *
 * @param imageDataUrl  Base64 data URL of the inspection image (jpeg preferred).
 * @param conf          Confidence threshold (defaults to active model config).
 * @param iou           IoU threshold (defaults to active model config).
 * @throws SpacesFallbackError if Spaces URL is not configured or request fails.
 */
export async function runSpacesFallback(
  imageDataUrl: string,
  conf?: number,
  iou?: number,
): Promise<Detection[]> {
  const cfg = getModelConfig(getActiveModelId());
  const { spacesUrl } = cfg;
  const confThreshold = conf ?? cfg.confThreshold;
  const iouThreshold = iou ?? cfg.iouThreshold;

  if (!spacesUrl) {
    throw new SpacesFallbackError(
      "Spaces fallback URL is not configured (VITE_SPACES_URL is absent).",
      "NETWORK",
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(`${spacesUrl}/run/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [imageDataUrl, confThreshold, iouThreshold] }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const statusText = res.status === 503 ? "Spaces server is waking up…" : res.statusText;
      throw new SpacesFallbackError(`Spaces returned HTTP ${res.status}: ${statusText}`, "NETWORK");
    }

    const json = (await res.json()) as SpacesResponse;

    if (!Array.isArray(json.data) || json.data.length < 2) {
      throw new SpacesFallbackError(
        "Unexpected Spaces response: data array missing or too short.",
        "RUNTIME",
      );
    }

    const jsonOutput = json.data[1];

    if (!jsonOutput || !Array.isArray(jsonOutput.detections)) {
      throw new SpacesFallbackError(
        "Unexpected Spaces response shape. Expected data[1].detections array.",
        "RUNTIME",
      );
    }

    return adaptSpacesDetections(jsonOutput.detections);
  } catch (err) {
    if (err instanceof SpacesFallbackError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new SpacesFallbackError(
        "Spaces request timed out after 60 seconds. The server may still be starting up.",
        "NETWORK",
      );
    }
    throw new SpacesFallbackError(
      `Spaces fallback failed: ${err instanceof Error ? err.message : String(err)}`,
      "NETWORK",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
