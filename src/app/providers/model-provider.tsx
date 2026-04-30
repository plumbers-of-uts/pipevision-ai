import { type ReactNode, createContext, useContext } from "react";

/**
 * ModelStatus — full type from design doc §7.3.
 * Only `idle` phase is used in Sprint 2; full state machine implemented in Sprint 3 (T3.5).
 */
export type ModelStatus =
  | { phase: "idle" }
  | { phase: "fetching"; loaded: number; total: number }
  | { phase: "compiling" }
  | { phase: "warming" }
  | { phase: "ready"; source: "network" | "cache" }
  | { phase: "error"; reason: string; retryable: boolean };

interface ModelContextValue {
  status: ModelStatus;
}

const ModelContext = createContext<ModelContextValue | null>(null);

interface ModelProviderProps {
  children: ReactNode;
}

/**
 * ModelProvider — stub for Sprint 2.
 * Returns `{ phase: 'idle' }` as a constant.
 * Full ORT session lifecycle + state machine implemented in Sprint 3 (T3.5).
 */
export function ModelProvider({ children }: ModelProviderProps) {
  const value: ModelContextValue = {
    status: { phase: "idle" },
  };

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

/**
 * useModelStatus — returns current model loading status.
 * Must be used within a ModelProvider subtree.
 */
export function useModelStatus(): ModelStatus {
  const ctx = useContext(ModelContext);
  if (ctx === null) {
    throw new Error("useModelStatus must be used within a ModelProvider");
  }
  return ctx.status;
}
