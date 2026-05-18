/**
 * seed-provider.tsx — Bootstraps demo data on first mount.
 *
 * Calls seedIfEmpty() once after a brief idle delay so the initial render
 * (sidebar, route shell) is not blocked. The delay uses requestIdleCallback
 * when available (modern browsers), with a 500 ms setTimeout fallback.
 *
 * Status lifecycle:
 *   pending → seeded   (records were inserted)
 *   pending → skipped  (store was already non-empty)
 *   pending → error    (IndexedDB unavailable or insert failed)
 *
 * useDemoSeed() exposes the current status to any component that needs to
 * gate on seeding completion (e.g., dashboard widgets, history table).
 */

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

import { bakeLegacyThumbnails } from "@/features/history-store/migrate-thumbnails";
import { seedIfEmpty } from "@/features/history-store/seed";

// ─── Types ────────────────────────────────────────────────────────────────────

type SeedStatus = "pending" | "seeded" | "skipped" | "error";
type ThumbnailBakeStatus = "pending" | "running" | "done" | "error";

interface SeedContextValue {
  status: SeedStatus;
  /**
   * Tracks the one-shot thumbnail migration that bakes detection overlays
   * into legacy records. Widgets that render thumbnails can include this in
   * their refresh dependencies so the list refreshes once baking finishes.
   */
  thumbnailBake: ThumbnailBakeStatus;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SeedContext = createContext<SeedContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface SeedProviderProps {
  children: ReactNode;
}

/**
 * SeedProvider — wraps the app and triggers demo data seeding on idle.
 *
 * Mount this inside the existing providers (ThemeProvider, ModelProvider)
 * and outside the HashRouter so it runs regardless of the active route.
 */
export function SeedProvider({ children }: SeedProviderProps) {
  const [status, setStatus] = useState<SeedStatus>("pending");
  const [thumbnailBake, setThumbnailBake] = useState<ThumbnailBakeStatus>("pending");

  const runSeed = useCallback(async () => {
    try {
      const result = await seedIfEmpty();
      setStatus(result.skipped ? "skipped" : "seeded");
    } catch {
      setStatus("error");
    }

    // Bake annotated thumbnails for any rows still on the legacy raw-image
    // format. Runs serially after seeding so a freshly-seeded store gets its
    // overlays too. Failures here are non-fatal — the raw thumbnail stays.
    setThumbnailBake("running");
    try {
      await bakeLegacyThumbnails();
      setThumbnailBake("done");
    } catch (err) {
      console.warn("[SeedProvider] thumbnail bake migration failed", err);
      setThumbnailBake("error");
    }
  }, []);

  useEffect(() => {
    // Use requestIdleCallback when available so seeding does not compete
    // with the initial render and layout work.
    if (typeof requestIdleCallback !== "undefined") {
      const handle = requestIdleCallback(() => {
        void runSeed();
      });
      return () => cancelIdleCallback(handle);
    }

    // Fallback: defer by 500 ms on browsers without requestIdleCallback (Safari < 16).
    const timer = setTimeout(() => {
      void runSeed();
    }, 500);
    return () => clearTimeout(timer);
  }, [runSeed]);

  return <SeedContext.Provider value={{ status, thumbnailBake }}>{children}</SeedContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useDemoSeed — returns the current seeding status.
 * Must be used within a SeedProvider subtree.
 */
export function useDemoSeed(): SeedContextValue {
  const ctx = useContext(SeedContext);
  if (ctx === null) {
    throw new Error("useDemoSeed must be used within a SeedProvider");
  }
  return ctx;
}
