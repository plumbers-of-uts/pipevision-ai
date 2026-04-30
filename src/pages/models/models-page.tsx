/**
 * models-page.tsx — Model Information page.
 *
 * Sections (top to bottom):
 *   1. Architecture summary (YOLO26m, 21.8M params, FP16 ONNX, 44 MB, opset 17)
 *   2. Dataset info (Roboflow Sewage Defect Detection, 980 images, 70/20/10 split)
 *   3. MetricsTable (test + val tabs, per-class PDF numbers)
 *   4. PerClassChart (horizontal bar, mAP@0.5 sorted desc)
 *   5. TrainingCurveChart (loss + mAP vs epoch, best ckpt at ep 57)
 *   6. FutureWorkCards (6 planned experiments from PDF)
 *
 * Matches gui-mockup.html #page-models (lines 1325-end).
 * All mAP numbers are the honest PDF values (0.44 overall). No fake 94%.
 */

import { BookOpen, Brain, ChartLine, Database, FlaskConical, LayoutGrid } from "lucide-react";

import { FutureWorkCards } from "@/widgets/future-work-cards";
import { MetricsTable } from "@/widgets/metrics-table";
import { PerClassChart } from "@/widgets/per-class-chart";
import { TrainingCurveChart } from "@/widgets/training-curve-chart";

// ─── Spec data ────────────────────────────────────────────────────────────────

const ARCH_SPECS = [
  { key: "Architecture", val: "YOLO26m (Ultralytics)" },
  { key: "Parameters", val: "21.8M" },
  { key: "Precision", val: "FP16 ONNX" },
  { key: "Model size", val: "44 MB" },
  { key: "ONNX opset", val: "17" },
  { key: "Input size", val: "640 × 640" },
  { key: "mAP@0.5", val: "0.440 (test)" },
  { key: "mAP@0.5:0.95", val: "0.198 (test)" },
  { key: "Best epoch", val: "57 / 100" },
  { key: "Framework", val: "PyTorch 2.x + Ultralytics" },
] as const;

const DATASET_SPECS = [
  { key: "Source", val: "Roboflow Sewage Defect Detection" },
  { key: "Total images", val: "980" },
  { key: "Train split", val: "70% (686 images)" },
  { key: "Val split", val: "20% (196 images)" },
  { key: "Test split", val: "10% (98 images)" },
  { key: "Classes", val: "7 defect categories" },
  { key: "Class imbalance", val: "22.5:1 long-tail (Crack dominant)" },
  { key: "Annotation", val: "YOLO format bounding boxes" },
] as const;

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
  return (
    <main id="main-content" className="overflow-y-auto p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-fg-primary">Model Information</h1>
        <p className="mt-1 text-[13px] text-fg-tertiary">
          YOLO-based object detection for sewer pipe defect analysis — academic benchmark results
        </p>
      </div>

      {/* Architecture + Dataset two-column */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section
          className="rounded-lg border border-border-default bg-bg-surface p-5"
          aria-label="Model architecture"
        >
          <SectionHeading icon={Brain} title="Model Architecture" />
          <div className="flex flex-col">
            {ARCH_SPECS.map((s) => (
              <SpecRow key={s.key} label={s.key} value={s.val} />
            ))}
          </div>
          <p className="mt-3 rounded bg-accent-muted px-3 py-2 text-[11px] leading-relaxed text-accent-text">
            mAP@0.5 = 0.440 is the PDF benchmark result on the held-out test set (design constraint
            D9 — honest accuracy).
          </p>
        </section>

        <section
          className="rounded-lg border border-border-default bg-bg-surface p-5"
          aria-label="Dataset information"
        >
          <SectionHeading icon={Database} title="Dataset Information" />
          <div className="flex flex-col">
            {DATASET_SPECS.map((s) => (
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

      {/* Per-class metrics table */}
      <section
        className="mb-6 rounded-lg border border-border-default bg-bg-surface p-5"
        aria-label="Per-class metrics"
      >
        <SectionHeading icon={LayoutGrid} title="Per-Class Metrics (PDF §1.1)" />
        <MetricsTable />
      </section>

      {/* Per-class mAP bar chart */}
      <section
        className="mb-6 rounded-lg border border-border-default bg-bg-surface p-5"
        aria-label="mAP by class chart"
      >
        <SectionHeading icon={ChartLine} title="mAP@0.5 by Class" />
        <PerClassChart />
      </section>

      {/* Training curve chart */}
      <section
        className="mb-6 rounded-lg border border-border-default bg-bg-surface p-5"
        aria-label="Training curves"
      >
        <SectionHeading icon={ChartLine} title="Training Curves (Epoch 1–100)" />
        <TrainingCurveChart />
        <p className="mt-3 text-[11px] text-fg-tertiary">
          Note: training curve values are plausible mock data derived from the reported final
          metrics. Actual per-epoch logs were not included in the PDF.
        </p>
      </section>

      {/* Future work cards */}
      <section aria-label="Planned future experiments">
        <SectionHeading icon={FlaskConical} title="Further Experiments (PDF §Further Work)" />
        <p className="mb-4 text-[13px] text-fg-secondary">
          Six planned experiments from the research paper to improve beyond the current 0.440
          mAP@0.5 baseline.
        </p>
        <FutureWorkCards />
      </section>

      {/* Reference footer */}
      <div className="mt-8 border-t border-border-default pt-4">
        <div className="flex items-start gap-2 text-[11px] text-fg-tertiary">
          <BookOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden={true} />
          <span>
            Source: Bo Zhao, Jadyn Braganza, Eunkwang Shin — "PipeVision AI: Sewer Pipe Defect
            Detection" (UTS, 2026). All metric values taken directly from the submitted PDF.
          </span>
        </div>
      </div>
    </main>
  );
}
