import { Check, Loader2 } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import type { ModelStatus } from "@/features/inference/types";
import { cn } from "@/lib/utils";

interface ModelLoadingProgressProps {
  status: ModelStatus;
  className?: string;
}

type StepKey = "fetching" | "compiling" | "warming";
type StepState = "done" | "active" | "pending";

interface StepDef {
  key: StepKey;
  title: string;
  hint: string;
}

const STEPS: readonly StepDef[] = [
  {
    key: "fetching",
    title: "Download",
    hint: "Streaming the ONNX model from HuggingFace. Cached after first load.",
  },
  {
    key: "compiling",
    title: "Compile",
    hint: "Selecting the fastest backend (WebGPU when available, WASM otherwise).",
  },
  {
    key: "warming",
    title: "Warm up",
    hint: "Running a warm-up inference so the first real detection feels instant.",
  },
];

const PHASE_ORDER: Record<StepKey, number> = { fetching: 0, compiling: 1, warming: 2 };
const MIB = 1024 * 1024;

function formatMiB(bytes: number): string {
  return `${(bytes / MIB).toFixed(1)} MiB`;
}

function stepState(stepKey: StepKey, currentPhase: StepKey): StepState {
  if (PHASE_ORDER[stepKey] < PHASE_ORDER[currentPhase]) return "done";
  if (PHASE_ORDER[stepKey] === PHASE_ORDER[currentPhase]) return "active";
  return "pending";
}

interface StepIndicatorProps {
  index: number;
  state: StepState;
}

function StepIndicator({ index, state }: StepIndicatorProps) {
  if (state === "done") {
    return (
      <span
        className="flex size-6 items-center justify-center rounded-full bg-accent text-fg-inverse"
        aria-hidden="true"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        className="flex size-6 items-center justify-center rounded-full bg-accent text-fg-inverse"
        aria-hidden="true"
      >
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span
      className="flex size-6 items-center justify-center rounded-full border border-border-default bg-bg-elevated font-mono text-[11px] text-fg-tertiary"
      aria-hidden="true"
    >
      {index + 1}
    </span>
  );
}

interface ActiveTrackProps {
  status: ModelStatus;
}

function ActiveTrack({ status }: ActiveTrackProps) {
  if (status.phase === "fetching") {
    const knownTotal = status.total > 0;
    const pct = knownTotal ? Math.min(100, Math.round((status.loaded / status.total) * 100)) : 0;
    return (
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between font-mono text-[11px] tabular-nums text-fg-tertiary">
          <span>
            {knownTotal
              ? `${formatMiB(status.loaded)} / ${formatMiB(status.total)}`
              : formatMiB(status.loaded)}
          </span>
          <span>{knownTotal ? `${pct}%` : "…"}</span>
        </div>
        {knownTotal ? (
          <Progress value={pct} className="h-1.5" aria-label={`Download progress: ${pct}%`} />
        ) : (
          <IndeterminateBar />
        )}
      </div>
    );
  }

  if (status.phase === "compiling" || status.phase === "warming") {
    return (
      <div className="mt-2">
        <IndeterminateBar />
      </div>
    );
  }

  return null;
}

function IndeterminateBar() {
  return (
    <div
      className="relative h-1.5 w-full overflow-hidden rounded-full bg-accent/15"
      aria-hidden="true"
    >
      <div className="absolute inset-y-0 left-0 w-1/3 animate-[loading-shimmer_1.4s_ease-in-out_infinite] rounded-full bg-accent/70" />
    </div>
  );
}

export function ModelLoadingProgress({ status, className }: ModelLoadingProgressProps) {
  const isLoading =
    status.phase === "fetching" || status.phase === "compiling" || status.phase === "warming";

  if (!isLoading) return null;

  const currentPhase = status.phase as StepKey;

  return (
    <section
      className={cn("rounded-lg border border-accent/30 bg-accent/5 px-4 py-3", className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <ol className="flex flex-col gap-2">
        {STEPS.map((step, idx) => {
          const state = stepState(step.key, currentPhase);
          const isActive = state === "active";
          return (
            <li
              key={step.key}
              className={cn(
                "flex items-start gap-3 rounded-md px-1.5 py-1.5 transition-colors duration-150",
                isActive && "bg-accent/10",
              )}
              aria-current={isActive ? "step" : undefined}
            >
              <StepIndicator index={idx} state={state} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "text-[13px] font-medium",
                      state === "pending" ? "text-fg-tertiary" : "text-fg-primary",
                    )}
                  >
                    {step.title}
                  </span>
                  {state === "done" && (
                    <span className="font-mono text-[10px] uppercase tracking-wide text-success">
                      Done
                    </span>
                  )}
                </div>
                {isActive && <p className="mt-0.5 text-[11px] text-fg-secondary">{step.hint}</p>}
                {isActive && <ActiveTrack status={status} />}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
