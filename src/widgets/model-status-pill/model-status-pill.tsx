/**
 * model-status-pill.tsx — Sidebar pill showing live model loading status.
 *
 * Renders a coloured dot + label for each phase of the model state machine.
 * Uses aria-live="polite" so screen readers announce phase transitions.
 *
 * Phase → dot colour mapping:
 *   idle      → grey (neutral)
 *   fetching  → blue (in-progress)
 *   compiling → blue (in-progress)
 *   warming   → blue (in-progress)
 *   ready     → green (success)
 *   error     → red (failure)
 */

import type { ModelStatus } from "@/features/inference/types";

interface ModelStatusPillProps {
  status: ModelStatus;
}

interface PillConfig {
  dotClass: string;
  label: string;
}

function getPillConfig(status: ModelStatus): PillConfig {
  switch (status.phase) {
    case "idle":
      return { dotClass: "bg-fg-tertiary", label: "Model: Not loaded" };
    case "fetching": {
      const pct = status.total > 0 ? ` ${Math.round((status.loaded / status.total) * 100)}%` : "";
      return {
        dotClass: "bg-accent animate-pulse",
        label: `Downloading…${pct}`,
      };
    }
    case "compiling":
      return { dotClass: "bg-accent animate-pulse", label: "Compiling…" };
    case "warming":
      return { dotClass: "bg-accent animate-pulse", label: "Warming up…" };
    case "ready":
      return {
        dotClass: "bg-success shadow-[0_0_6px_currentColor] text-success",
        label: `Model: ${status.backend === "webgpu" ? "WebGPU" : "WASM"}`,
      };
    case "error":
      return { dotClass: "bg-error", label: "Model: Error" };
  }
}

export function ModelStatusPill({ status }: ModelStatusPillProps) {
  const { dotClass, label } = getPillConfig(status);

  return (
    <div
      className="flex items-center gap-2 text-[11px] text-fg-tertiary"
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        className={`inline-block size-[7px] shrink-0 rounded-full ${dotClass}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
