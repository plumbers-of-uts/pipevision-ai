/**
 * models-page.tsx — Model Information page.
 *
 * Sections (top to bottom):
 *   1. Architecture summary (from MODEL_REGISTRY[activeId].archSpecs)
 *   2. Dataset info (from MODEL_REGISTRY[activeId].datasetSpecs)
 *   3. PerClassChart — rendered only when the active model has class metrics
 *
 * The active model is resolved from active-model-store and reacts to the
 * sidebar ModelSelector.
 */

import { Brain, ChartLine, Database } from "lucide-react";

import { useActiveModelId } from "@/features/inference/active-model-store";
import { MODEL_REGISTRY } from "@/features/inference/model-config";
import { PerClassChart } from "@/widgets/per-class-chart";

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className="size-4 text-accent" aria-hidden={true} />
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.6px] text-fg-secondary">
        {title}
      </h2>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border-default py-2 last:border-0">
      <span className="shrink-0 text-[11px] font-medium text-fg-tertiary">{label}</span>
      <span className="text-right font-mono text-[12px] font-medium text-fg-primary">{value}</span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function ModelsPage() {
  const activeId = useActiveModelId();
  const cfg = MODEL_REGISTRY[activeId];

  return (
    <main id="main-content" className="overflow-y-auto p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-fg-primary">Model Information</h1>
        <p className="mt-1 text-[13px] text-fg-tertiary">
          {cfg.displayName} — sewer pipe defect detection benchmark results
        </p>
        {!cfg.isConfigured ? (
          <p className="mt-2 text-[12px] text-warning">
            This model is not yet available. The ONNX export hasn't been uploaded.
          </p>
        ) : null}
      </div>

      {/* Architecture + Dataset two-column */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section
          className="rounded-lg border border-border-default bg-bg-surface p-5"
          aria-label="Model architecture"
        >
          <SectionHeading icon={Brain} title="Model Architecture" />
          <div className="flex flex-col">
            {cfg.archSpecs.map((s) => (
              <SpecRow key={s.key} label={s.key} value={s.val} />
            ))}
          </div>
        </section>

        <section
          className="rounded-lg border border-border-default bg-bg-surface p-5"
          aria-label="Dataset information"
        >
          <SectionHeading icon={Database} title="Dataset Information" />
          <div className="flex flex-col">
            {cfg.datasetSpecs.map((s) => (
              <SpecRow key={s.key} label={s.key} value={s.val} />
            ))}
          </div>

          {/* 70/20/10 split bar */}
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-fg-tertiary">
              Train / Val / Test Split
            </div>
            <div
              className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
              role="img"
              aria-label="Dataset split: 70% train, 20% val, 10% test"
            >
              <div className="h-full rounded-l-full bg-accent" style={{ width: "70%" }} />
              <div className="h-full bg-info" style={{ width: "20%" }} />
              <div className="h-full rounded-r-full bg-severity-medium" style={{ width: "10%" }} />
            </div>
            <div className="mt-1.5 flex gap-4 text-[11px]">
              <span className="text-accent">Train 70% (686)</span>
              <span className="text-info">Val 20% (196)</span>
              <span className="text-severity-medium">Test 10% (98)</span>
            </div>
          </div>
        </section>
      </div>

      {/* Per-class mAP bar chart — only when metrics are available for this model */}
      {cfg.classMetrics !== null ? (
        <section
          className="mb-6 rounded-lg border border-border-default bg-bg-surface p-5"
          aria-label="mAP by class chart"
        >
          <SectionHeading icon={ChartLine} title="mAP@0.5 by Class" />
          <PerClassChart data={cfg.classMetrics} />
        </section>
      ) : (
        <section
          className="mb-6 rounded-lg border border-dashed border-border-default bg-bg-surface/60 p-5 text-center"
          aria-label="Per-class metrics placeholder"
        >
          <SectionHeading icon={ChartLine} title="mAP@0.5 by Class" />
          <p className="text-[12px] text-fg-tertiary">
            Per-class metrics will appear here once the model is benchmarked.
          </p>
        </section>
      )}
    </main>
  );
}
