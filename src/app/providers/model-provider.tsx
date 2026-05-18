/**
 * model-provider.tsx — 5-phase ORT model lifecycle provider.
 *
 * Phases: idle → fetching → compiling → warming → ready / error
 *
 * Key design decisions:
 *   - Module-scope sessionRef: survives React HMR / StrictMode double-mount.
 *   - ensureReady(): concurrent calls share the single in-flight Promise.
 *   - SHA-256 integrity (T14): bust SW cache + 1 retry on mismatch, then INTEGRITY error.
 *   - Fetch progress via ReadableStream reader → {loaded, total} dispatched to reducer.
 *   - retry({bustCache}): clears pv-model-v1 cache entries matching the model URL.
 *
 * C5' contract: ready.backend (not ep), error.code: ErrorCode.
 * D13 preserved: no Web Workers.
 */

import { type ReactNode, createContext, useCallback, useContext, useReducer, useRef } from "react";

import type { InferenceSession } from "onnxruntime-web";

import { clearInferenceService, getInferenceService } from "@/features/inference/inference-service";
import { MODEL_CONFIG } from "@/features/inference/model-config";
import { selectBackend } from "@/features/inference/runtime-select";
import type { ErrorCode, ModelContextValue, ModelStatus } from "@/features/inference/types";
import { getOrt } from "@/lib/onnx/ort-loader";

// ─── Module-scope state (survives HMR and StrictMode double-mount) ────────────

/** Holds the active ORT session across re-renders and hot-module reloads. */
let sessionRef: InferenceSession | null = null;
/** Active backend resolved during model load. */
let backendRef: "webgpu" | "wasm" | null = null;
/** Single in-flight promise — concurrent ensureReady() calls share this. */
let ensureReadyPromise: Promise<void> | null = null;

// ─── Reducer ─────────────────────────────────────────────────────────────────

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_PROGRESS"; loaded: number; total: number }
  | { type: "COMPILING" }
  | { type: "WARMING" }
  | { type: "READY"; source: "network" | "cache"; backend: "webgpu" | "wasm" }
  | { type: "ERROR"; reason: string; retryable: boolean; code: ErrorCode }
  | { type: "RESET" };

function reducer(_state: ModelStatus, action: Action): ModelStatus {
  switch (action.type) {
    case "FETCH_START":
      return { phase: "fetching", loaded: 0, total: 0 };
    case "FETCH_PROGRESS":
      return { phase: "fetching", loaded: action.loaded, total: action.total };
    case "COMPILING":
      return { phase: "compiling" };
    case "WARMING":
      return { phase: "warming" };
    case "READY":
      return { phase: "ready", source: action.source, backend: action.backend };
    case "ERROR":
      return {
        phase: "error",
        reason: action.reason,
        retryable: action.retryable,
        code: action.code,
      };
    case "RESET":
      return { phase: "idle" };
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ModelContext = createContext<ModelContextValue | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute SHA-256 of an ArrayBuffer, return lowercase hex string. */
async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Fetch model bytes, streaming progress to the dispatch callback.
 * Returns { buf, source } — source is 'cache' when served from SW, 'network' otherwise.
 */
async function fetchModelBuffer(
  url: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<{ buf: ArrayBuffer; source: "network" | "cache" }> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    const networkErr = new Error(
      `Couldn't reach the model server. ${err instanceof Error ? err.message : ""}`,
    ) as Error & { code: ErrorCode };
    networkErr.code = "NETWORK";
    throw networkErr;
  }

  if (!res.ok) {
    const networkErr = new Error(
      `Couldn't reach the model server. HTTP ${res.status}: ${res.statusText}`,
    ) as Error & { code: ErrorCode };
    networkErr.code = "NETWORK";
    throw networkErr;
  }

  // Detect cache-hit: SW sets x-from-cache header, or response is from cache storage
  const fromCacheHeader = res.headers.get("x-from-cache");
  const source: "network" | "cache" = fromCacheHeader === "1" ? "cache" : "network";

  // Stream body for progress reporting
  const contentLength = res.headers.get("content-length");
  const total = contentLength !== null ? Number.parseInt(contentLength, 10) : 0;

  if (res.body === null) {
    const buf = await res.arrayBuffer();
    onProgress(buf.byteLength, buf.byteLength);
    return { buf, source };
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(loaded, total > 0 ? total : loaded);
    }
  }

  // Concatenate chunks into a single ArrayBuffer
  const combined = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { buf: combined.buffer, source };
}

/** Map an unknown thrown value to a typed ErrorCode. */
function inferErrorCode(err: unknown): ErrorCode {
  if (err instanceof Error) {
    const tagged = (err as { code?: ErrorCode }).code;
    if (tagged !== undefined) return tagged;
    if (err instanceof TypeError) return "NETWORK";
  }
  return "RUNTIME";
}

/** Delete all SW cache entries that match the model URL pattern. */
async function bustSwCache(url: string): Promise<void> {
  if (!("caches" in globalThis)) return;
  try {
    const cache = await caches.open("pv-model-v1");
    const keys = await cache.keys();
    await Promise.all(
      keys
        .filter((req) => req.url.includes(url) || req.url.endsWith(".onnx"))
        .map((req) => cache.delete(req)),
    );
  } catch {
    // Non-fatal: continue even if SW cache is unavailable
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ModelProviderProps {
  children: ReactNode;
}

export function ModelProvider({ children }: ModelProviderProps) {
  const [status, dispatch] = useReducer(reducer, { phase: "idle" });

  // Mirror the latest status into a ref so ensureReady() can stay referentially
  // stable. Without this, ensureReady changes on every phase transition, which
  // re-fires the consumer's useEffect and — on an "error" phase — restarts the
  // whole load in a tight loop.
  const statusRef = useRef(status);
  statusRef.current = status;

  /**
   * Core load sequence. Shared across all concurrent ensureReady() callers.
   * integrityRetry=true means this is the second attempt after a cache bust.
   */
  const loadModel = useCallback(
    async (bustCache = false, integrityRetry = false): Promise<void> => {
      const { modelUrl, sha256, isConfigured } = MODEL_CONFIG;

      // Fail-loud when URL is not configured (S2 policy)
      if (!isConfigured || !modelUrl) {
        dispatch({
          type: "ERROR",
          reason:
            "Model URL is not configured. Set VITE_MODEL_URL in your environment and rebuild.",
          retryable: false,
          code: "NETWORK",
        });
        return;
      }

      if (!sha256) {
        console.warn(
          "[ModelProvider] VITE_MODEL_SHA256 is not set — integrity check skipped (dev mode).",
        );
      }

      if (bustCache) {
        await bustSwCache(modelUrl);
      }

      try {
        // Phase 1: Fetching
        dispatch({ type: "FETCH_START" });

        const { buf, source } = await fetchModelBuffer(modelUrl, (loaded, total) => {
          dispatch({ type: "FETCH_PROGRESS", loaded, total });
        });

        // SHA-256 integrity check (T14)
        if (sha256 && sha256.length === 64) {
          const actual = await sha256Hex(buf);
          if (actual !== sha256.toLowerCase()) {
            if (!integrityRetry) {
              // Bust cache and retry once automatically
              dispatch({
                type: "ERROR",
                reason: "Model file appears corrupted; refreshing cache…",
                retryable: true,
                code: "INTEGRITY",
              });
              await bustSwCache(modelUrl);
              ensureReadyPromise = null;
              // Tail-recurse: one retry with integrityRetry=true
              return loadModel(true, true);
            }
            // Second failure — hard error
            dispatch({
              type: "ERROR",
              reason:
                "Model integrity check failed after cache bust. The downloaded file may be corrupted.",
              retryable: false,
              code: "INTEGRITY",
            });
            return;
          }
        }

        // Phase 2: Compiling (create ORT InferenceSession)
        dispatch({ type: "COMPILING" });

        const backend = await selectBackend();
        const ort = await getOrt();

        const executionProviders: string[] = backend === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];

        let session: InferenceSession;
        try {
          session = await ort.InferenceSession.create(buf, { executionProviders });
        } catch {
          if (backend === "webgpu") {
            // Automatically fall back to WASM on WebGPU session create failure
            try {
              session = await ort.InferenceSession.create(buf, {
                executionProviders: ["wasm"],
              });
            } catch (fallbackErr) {
              const e = new Error(
                `Couldn't initialize the model. ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
              ) as Error & { code: ErrorCode };
              e.code = "SESSION_CREATE";
              throw e;
            }
          } else {
            const e = new Error("Couldn't initialize the model.") as Error & { code: ErrorCode };
            e.code = "SESSION_CREATE";
            throw e;
          }
        }

        // Phase 3: Warming (validates dtype, detects layout)
        dispatch({ type: "WARMING" });

        clearInferenceService();
        await getInferenceService(session, backend);

        sessionRef = session;
        backendRef = backend;

        dispatch({ type: "READY", source, backend });
      } catch (err) {
        // Surface the raw error to the console — the UI shows a friendly mapped
        // message, but the underlying stack/message is essential for debugging.
        console.error("[ModelProvider] load failed:", err);
        const code: ErrorCode = inferErrorCode(err);
        const retryable = code !== "UNSUPPORTED";
        dispatch({
          type: "ERROR",
          reason: err instanceof Error ? err.message : "Unknown error during model load.",
          retryable,
          code,
        });
      }
    },
    [],
  );

  const ensureReady = useCallback((): Promise<void> => {
    const current = statusRef.current;
    if (current.phase === "ready") return Promise.resolve();
    if (ensureReadyPromise !== null) return ensureReadyPromise;
    // Auto-load is one-shot per provider lifetime. Once a load has resolved to
    // "error", further work must come from an explicit retry() — otherwise the
    // consumer's useEffect dep change would re-enter loadModel forever.
    if (current.phase === "error") {
      return Promise.reject(new Error(current.reason));
    }
    ensureReadyPromise = loadModel(false).finally(() => {
      ensureReadyPromise = null;
    });
    return ensureReadyPromise;
  }, [loadModel]);

  const retry = useCallback(
    (opts?: { bustCache?: boolean }): Promise<void> => {
      ensureReadyPromise = null;
      sessionRef = null;
      backendRef = null;
      clearInferenceService();
      dispatch({ type: "RESET" });

      ensureReadyPromise = loadModel(opts?.bustCache ?? false).finally(() => {
        ensureReadyPromise = null;
      });
      return ensureReadyPromise;
    },
    [loadModel],
  );

  const value: ModelContextValue = { status, ensureReady, retry };

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * useModelStatus — returns the current model loading status.
 * Subscribe-only: does NOT trigger ensureReady().
 * Safe to use in Dashboard, Sidebar, etc. (D-G decision).
 */
export function useModelStatus(): ModelStatus {
  const ctx = useContext(ModelContext);
  if (ctx === null) {
    throw new Error("useModelStatus must be used within a ModelProvider");
  }
  return ctx.status;
}

/**
 * useModelContext — full context including ensureReady() and retry().
 * Only Detect page should call ensureReady().
 */
export function useModelContext(): ModelContextValue {
  const ctx = useContext(ModelContext);
  if (ctx === null) {
    throw new Error("useModelContext must be used within a ModelProvider");
  }
  return ctx;
}

/**
 * Returns the active InferenceSession or null if not ready.
 * Module-scope reference — safe to access from inference-service singleton.
 */
export function getActiveSession(): InferenceSession | null {
  return sessionRef;
}

/**
 * Returns the active backend label or null if not ready.
 */
export function getActiveBackend(): "webgpu" | "wasm" | null {
  return backendRef;
}
