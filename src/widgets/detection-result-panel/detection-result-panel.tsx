/**
 * detection-result-panel.tsx — Right-side panel showing detection results.
 * Lists each detected class with confidence bar, severity badge.
 * Matches gui-mockup.html .results-panel + .defect-list + .grade-section.
 */

"use client";

import { CheckCircle2, ListChecks } from "lucide-react";

import type { Detection } from "@/features/history-store/types";
import { cn } from "@/lib/utils";

type Severity = "critical" | "high" | "medium" | "low";

const SEV_STYLES: Record<Severity, { badge: string; label: string }> = {
  critical: { badge: "bg-[#fde8e8] text-[#d9363e]", label: "Critical" },
  high: { badge: "bg-[#fff0e0] text-[#c05a1a]", label: "High" },
  medium: { badge: "bg-[#fef9e7] text-[#8a6d00]", label: "Medium" },
  low: { badge: "bg-[#e8f8ef] text-[#1a7a3a]", label: "Low" },
};

/** Compute a simple pipe condition grade from detections. */
function computeGrade(detections: Detection[]): { letter: string; label: string; desc: string } {
  if (detections.length === 0) {
    return {
      letter: "A",
      label: "Grade A — Excellent",
      desc: "No defects detected. Pipe appears structurally sound.",
    };
  }
  const hasCritical = detections.some((d) => d.severity === "critical");
  const hasHigh = detections.some((d) => d.severity === "high");
  if (hasCritical) {
    return {
      letter: "D",
      label: "Grade D — Immediate Action Required",
      desc: "Critical structural defects detected. Urgent repair needed.",
    };
  }
  if (hasHigh || detections.length >= 3) {
    return {
      letter: "C",
      label: "Grade C — Requires Attention",
      desc: "Multiple defects detected. Schedule maintenance within 3 months.",
    };
  }
  return {
    letter: "B",
    label: "Grade B — Monitor",
    desc: "Minor defects present. Monitor at next scheduled inspection.",
  };
}

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#f59e0b",
  C: "#ef4444",
  D: "#dc2626",
};

interface DetectionResultPanelProps {
  detections: Detection[];
  inferenceMs: number;
}

export function DetectionResultPanel({ detections, inferenceMs }: DetectionResultPanelProps) {
  const grade = computeGrade(detections);
  const gradeColor = GRADE_COLORS[grade.letter] ?? "#6b7280";

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border-default bg-bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default bg-bg-elevated px-4 py-3.5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-fg-primary">
          <ListChecks className="size-4 text-accent" aria-hidden={true} />
          Detection Results
        </div>
        <div className="font-mono text-[11px] text-fg-tertiary">
          {(inferenceMs / 1000).toFixed(2)}s
        </div>
      </div>

      {/* Defect list */}
      <div
        className="flex flex-1 flex-col gap-2 overflow-y-auto p-3"
        role="list"
        aria-label="Detected defects"
      >
        {detections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="size-8 text-success" aria-hidden={true} />
            <div className="text-sm font-medium text-fg-primary">No defects detected</div>
            <div className="text-xs text-fg-tertiary">
              Pipe appears clean and structurally sound.
            </div>
          </div>
        ) : (
          detections.map((det, idx) => {
            const sev = det.severity as Severity;
            const style = SEV_STYLES[sev] ?? SEV_STYLES.low;

            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: list is stable after detection
                key={`${det.id}-${idx}`}
                role="listitem"
                className="rounded border border-border-default bg-bg-elevated p-3 transition-colors hover:bg-bg-overlay"
                style={{ borderLeft: `3px solid ${det.color}` }}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-semibold text-fg-primary">{det.className}</div>
                    <div className="font-mono text-[10px] text-fg-tertiary">
                      Instance #{idx + 1}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      style.badge,
                    )}
                  >
                    {style.label}
                  </span>
                </div>

                {/* Confidence bar */}
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-base">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(det.confidence * 100).toFixed(0)}%`,
                        background: det.color,
                      }}
                      role="progressbar"
                      aria-valuenow={Math.round(det.confidence * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Confidence ${(det.confidence * 100).toFixed(0)}%`}
                    />
                  </div>
                  <div className="w-9 text-right font-mono text-[11px] text-fg-secondary">
                    {(det.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pipe Condition Grade */}
      <div className="border-t border-border-default bg-bg-base p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.5px] text-fg-tertiary">
          Pipe Condition Score
        </div>
        <div className="flex items-center gap-4">
          {/* Grade circle */}
          <div
            className="flex size-[72px] shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(${gradeColor} 0% 60%, #e5e7eb 60% 100%)`,
            }}
            aria-label={`Grade ${grade.letter}`}
          >
            <div
              className="flex size-[54px] items-center justify-center rounded-full bg-white text-2xl font-extrabold"
              style={{ color: gradeColor }}
            >
              {grade.letter}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-fg-primary">{grade.label}</div>
            <div className="mt-1 text-[11px] leading-relaxed text-fg-tertiary">{grade.desc}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
