/**
 * use-inference.ts — React hook wrapping InferenceService for the Detect page.
 *
 * Responsibilities:
 *   - Retrieve the active session + backend from ModelProvider.
 *   - Delegate to InferenceService.run().
 *   - Map InferenceRawDetection[] → Detection[] (uuid, PIPEVISION_CLASSES lookup).
 *   - isRunning guard: ignores concurrent calls.
 *   - runWithFallback: tries local inference first; falls back to Spaces on error.
 */

import { useCallback, useRef, useState } from "react";

import { v4 as uuidv4 } from "uuid";

import { getActiveBackend, getActiveSession } from "@/app/providers/model-provider";
import { CLASS_BY_ID } from "@/features/history-store/classes";
import type { Detection } from "@/features/history-store/types";
import { runSpacesFallback } from "./fallback-spaces";
import { getInferenceService } from "./inference-service";
import type { ErrorCode, InferenceInput, InferenceRawDetection } from "./types";

// ─── Mapping ──────────────────────────────────────────────────────────────────

/**
 * Map raw detections (classId + bbox in original pixel space) to the
 * Detection contract (C3) consumed by canvas, result panel, and IndexedDB.
 */
function mapToDetections(raw: InferenceRawDetection[]): Detection[] {
  return raw.map((r) => {
    const meta = CLASS_BY_ID[r.classId];
    return {
      id: uuidv4(),
      classId: r.classId,
      className: meta?.name ?? `Class ${r.classId}`,
      severity: meta?.severity ?? "low",
      confidence: r.score,
      bbox: r.bbox,
      color: meta?.color ?? "#888888",
    };
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseInferenceResult {
  /** Run local ONNX inference. Throws if model not ready. */
  run: (input: InferenceInput) => Promise<Detection[]>;
  /**
   * Run local inference with automatic Spaces fallback on failure.
   * Returns { detections, source: 'local' | 'spaces' }.
   */
  runWithFallback: (
    input: InferenceInput,
    imageDataUrl: string,
  ) => Promise<{ detections: Detection[]; source: "local" | "spaces" }>;
  /** True while an inference is in progress (guards concurrent calls). */
  isRunning: boolean;
  /** Last error from run() or runWithFallback(), null otherwise. */
  lastError: { code: ErrorCode; message: string } | null;
  /** Total wall-clock ms from last successful run (preprocess + infer + postprocess). */
  lastTotalMs: number;
}

export function useInference(): UseInferenceResult {
  const [isRunning, setIsRunning] = useState(false);
  const [lastError, setLastError] = useState<{ code: ErrorCode; message: string } | null>(null);
  const [lastTotalMs, setLastTotalMs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (input: InferenceInput): Promise<Detection[]> => {
    const session = getActiveSession();
    const backend = getActiveBackend();
    if (session === null || backend === null) {
      throw new Error("Model is not ready. Call ensureReady() before running inference.");
    }

    // Cancel any previous run (e.g. page navigation, double-click).
    // Done BEFORE the isRunning guard so a new call supersedes the old one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setLastError(null);

    try {
      const service = await getInferenceService(session, backend);
      const result = await service.run(input, { signal: controller.signal });
      setLastTotalMs(result.totalMs);
      return mapToDetections(result.detections);
    } catch (err) {
      const code: ErrorCode = (err as { code?: ErrorCode }).code ?? "RUNTIME";
      const message = err instanceof Error ? err.message : "Inference failed.";
      setLastError({ code, message });
      throw err;
    } finally {
      setIsRunning(false);
    }
  }, []);

  const runWithFallback = useCallback(
    async (
      input: InferenceInput,
      imageDataUrl: string,
    ): Promise<{ detections: Detection[]; source: "local" | "spaces" }> => {
      try {
        const detections = await run(input);
        return { detections, source: "local" };
      } catch (err) {
        // Do not fall back on user-initiated cancellation (page navigation, double-click).
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        // Attempt Spaces fallback (only if URL is configured)
        const spacesDetections = await runSpacesFallback(imageDataUrl);
        return { detections: spacesDetections, source: "spaces" };
      }
    },
    [run],
  );

  return { run, runWithFallback, isRunning, lastError, lastTotalMs };
}
