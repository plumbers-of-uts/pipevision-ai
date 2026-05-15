/**
 * runtime-select.ts — Detects best available ORT execution provider.
 *
 * Priority: WebGPU → WASM SIMD → WASM (plain)
 *
 * Results are cached after the first call (capability detection is async and
 * should not be repeated on every model load attempt).
 *
 * D13 preserved: no Web Workers. All detection runs on main thread.
 */

export type Backend = "webgpu" | "wasm";

interface CapabilityCache {
  webgpu: boolean | null;
  simd: boolean | null;
}

const cache: CapabilityCache = { webgpu: null, simd: null };

/** Returns true if WebGPU adapter is available. Cached after first call. */
async function supportsWebGPU(): Promise<boolean> {
  if (cache.webgpu !== null) return cache.webgpu;
  try {
    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
      cache.webgpu = false;
      return false;
    }
    const adapter = await (
      navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }
    ).gpu.requestAdapter();
    cache.webgpu = adapter !== null;
  } catch {
    cache.webgpu = false;
  }
  return cache.webgpu;
}

/**
 * Returns the best available ORT execution provider.
 * WebGPU is attempted first; WASM is the universal fallback.
 */
export async function selectBackend(): Promise<Backend> {
  const gpu = await supportsWebGPU();
  return gpu ? "webgpu" : "wasm";
}
