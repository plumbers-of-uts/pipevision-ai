/**
 * ort-loader.ts — Dynamic importer for onnxruntime-web.
 *
 * This is the ONLY file that performs a runtime import of onnxruntime-web.
 * All other files use `import type { Tensor, InferenceSession }` exclusively.
 *
 * ORT WASM config:
 *   - wasmPaths: served from /ort/ (copied by vite-plugin-static-copy, T3)
 *   - numThreads: 1 — GitHub Pages has no COOP/COEP headers, SAB unavailable
 *   - proxy: false — D13 preserved (no Worker boundary in this sprint)
 *   - simd: true — prefer SIMD WASM for performance
 */

import type { InferenceSession, Tensor } from "onnxruntime-web";

// Re-export types for convenience — always `import type`, never runtime
export type { InferenceSession, Tensor };

// Module-scope singleton so we dynamic-import only once
let ortModule: typeof import("onnxruntime-web") | null = null;

/**
 * Returns the onnxruntime-web module, loading it lazily on first call.
 * Subsequent calls return the cached module synchronously.
 */
export async function getOrt(): Promise<typeof import("onnxruntime-web")> {
  if (ortModule !== null) return ortModule;

  // Dynamic import keeps ORT out of the main bundle (large WASM + JS)
  const ort = await import("onnxruntime-web");

  // Configure WASM environment before any session is created
  ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.simd = true;

  ortModule = ort;
  return ort;
}
