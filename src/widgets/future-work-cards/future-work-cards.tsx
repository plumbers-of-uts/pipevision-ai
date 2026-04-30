/**
 * future-work-cards.tsx — 6 cards from the PDF "Further Experiments" section.
 * All items are "Planned" status. Static content — no data fetching.
 * Matches design pattern of .model-card from gui-mockup.html.
 */

import { FlaskConical } from "lucide-react";

interface FutureWorkItem {
  id: string;
  title: string;
  description: string;
  expectedImpact: string;
}

const FUTURE_WORK_ITEMS: FutureWorkItem[] = [
  {
    id: "fw-augmentation",
    title: "Data Augmentation Strategies",
    description:
      "Apply Mosaic augmentation and random crop/scale jitter during training to increase effective dataset diversity and reduce spatial bias in detection.",
    expectedImpact: "+3–5% mAP@0.5 (estimated)",
  },
  {
    id: "fw-focal-loss",
    title: "Class-Balanced Sampling + Focal Loss",
    description:
      "Address the 22.5:1 long-tail class imbalance using oversampling of rare classes and Focal Loss (γ=2) to down-weight easy negatives and improve detection of rare defects like Hole.",
    expectedImpact: "+4–8% mAP on minority classes",
  },
  {
    id: "fw-attention",
    title: "CBAM / Deformable Attention",
    description:
      "Integrate Convolutional Block Attention Module (CBAM) or Deformable Attention into the backbone to improve spatial feature selectivity in occluded and low-contrast pipe regions.",
    expectedImpact: "+2–4% mAP@0.5:0.95",
  },
  {
    id: "fw-fpn",
    title: "FPN/PAN + TAL Multi-Scale",
    description:
      "Experiment with Feature Pyramid Network / Path Aggregation Network combined with Task-Aligned Learning (TAL) to better handle the wide range of defect sizes in CCTV imagery.",
    expectedImpact: "Improved small-defect recall",
  },
  {
    id: "fw-extended",
    title: "Extended Training (Epoch 200)",
    description:
      "Continue training beyond the current 57-epoch best checkpoint with cosine annealing LR schedule to explore whether the model has converged or can still improve on the validation set.",
    expectedImpact: "Potential +1–3% mAP@0.5",
  },
  {
    id: "fw-comparison",
    title: "Faster R-CNN Comparison",
    description:
      "Train a Faster R-CNN baseline on the same Roboflow Sewage Defect Detection dataset to provide a two-stage detector comparison and validate the YOLO single-stage approach's speed/accuracy trade-off.",
    expectedImpact: "Academic benchmark baseline",
  },
];

export function FutureWorkCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FUTURE_WORK_ITEMS.map((item) => (
        <article
          key={item.id}
          className="relative flex flex-col overflow-hidden rounded-lg border border-border-default bg-bg-surface p-5 transition-colors hover:border-border-hover"
        >
          {/* Bottom accent bar (mirrors mockup .model-card::after) */}
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-accent" aria-hidden="true" />

          {/* Header */}
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-muted">
              <FlaskConical className="size-5 text-accent" aria-hidden={true} strokeWidth={1.5} />
            </div>
            <span className="rounded-full border border-fg-tertiary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3px] text-fg-tertiary">
              Planned
            </span>
          </div>

          {/* Title */}
          <h3 className="mb-2 text-[14px] font-semibold leading-snug text-fg-primary">
            {item.title}
          </h3>

          {/* Description */}
          <p className="flex-1 text-[12px] leading-relaxed text-fg-secondary">{item.description}</p>

          {/* Expected impact */}
          <div className="mt-3 border-t border-border-default pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.5px] text-fg-tertiary">
              Expected Impact
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-accent-text">
              {item.expectedImpact}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
