/**
 * sw.ts — PipeVision AI Service Worker via Serwist.
 *
 * Strategies:
 *   - Precache app shell (HTML/CSS/JS via @serwist/vite injection point).
 *   - Cache-first for ONNX model files + ORT WASM, scoped to a host whitelist
 *     (self.origin + huggingface.co) per the C8' contract.
 *
 * Cache name: pv-model-v1 (bump only on incompatible SW logic changes).
 */

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const MODEL_CACHE = "pv-model-v1";

const ALLOWED_HOSTS = new Set([self.location.origin, "https://huggingface.co"]);

const ASSET_PATTERNS = [/\.onnx(\?|$)/, /ort-wasm.*\.wasm(\?|$)/];

function isAllowedAsset(url: URL): boolean {
  const origin = `${url.protocol}//${url.host}`;
  if (!ALLOWED_HOSTS.has(origin)) return false;
  return ASSET_PATTERNS.some((re) => re.test(url.pathname + url.search));
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ url }) => isAllowedAsset(url),
      handler: new CacheFirst({
        cacheName: MODEL_CACHE,
        plugins: [
          {
            // Attach x-from-cache header so ModelProvider can detect cache hits.
            cachedResponseWillBeUsed: async ({ cachedResponse }) => {
              if (cachedResponse === null || cachedResponse === undefined) return cachedResponse;
              const headers = new Headers(cachedResponse.headers);
              headers.set("x-from-cache", "1");
              return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                headers,
              });
            },
          },
        ],
      }),
    },
  ],
});

serwist.addEventListeners();
