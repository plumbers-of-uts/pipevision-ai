/**
 * sw-register.ts — registers the Serwist-generated service worker in production.
 *
 * Uses the `virtual:serwist` module exposed by @serwist/vite. The call is a
 * no-op outside production because the plugin disables itself during dev.
 */

import { getSerwist } from "virtual:serwist";

export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  try {
    const serwist = await getSerwist();
    await serwist?.register();
  } catch (err) {
    // Non-fatal: app still works without SW, just no model cache.
    console.warn("[sw-register] Service worker registration failed:", err);
  }
}
