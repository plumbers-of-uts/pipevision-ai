/**
 * active-model-store.ts — localStorage-backed selection of the active model.
 *
 * Persistence key: `pv-active-model`. Invalid / unknown values fall back to
 * `DEFAULT_MODEL_ID`. A tiny pub/sub layer lets React components (via
 * `useActiveModel`) and the `ModelProvider` reload the session when the
 * selection changes.
 */

import { useSyncExternalStore } from "react";

import { DEFAULT_MODEL_ID, type ModelId, isModelId } from "./model-config";

const STORAGE_KEY = "pv-active-model";

type Listener = (id: ModelId) => void;
const listeners = new Set<Listener>();

function readStored(): ModelId {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null && isModelId(raw)) return raw;
  } catch {
    // localStorage may throw in private mode — fall back silently.
  }
  return DEFAULT_MODEL_ID;
}

let current: ModelId = readStored();

export function getActiveModelId(): ModelId {
  return current;
}

export function setActiveModelId(id: ModelId): void {
  if (current === id) return;
  current = id;
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Non-fatal: in-memory state still updates.
  }
  for (const fn of listeners) fn(id);
}

export function subscribeActiveModel(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** React hook returning the currently-selected model id. */
export function useActiveModelId(): ModelId {
  return useSyncExternalStore(
    (onChange) => subscribeActiveModel(onChange),
    getActiveModelId,
    () => DEFAULT_MODEL_ID,
  );
}
