/**
 * types.ts — Re-exports and local type definitions for history-store feature.
 *
 * Contract source: C3 (Detection) and C4 (HistoryRecord) from pipevision-contracts.md.
 * These types are the single source of truth consumed by repository, seed, and UI.
 */

// ─── Severity ──────────────────────────────────────────────────────────────

export type Severity = "critical" | "high" | "medium" | "low";

// ─── Detection (contract C3) ────────────────────────────────────────────────

export interface Detection {
  /** uuid v4 — stable for canvas/list highlight */
  id: string;
  /** 0-6, matches metadata.yaml class ids */
  classId: number;
  /** human-readable class name from PIPEVISION_CLASSES */
  className: string;
  severity: Severity;
  /** 0-1 confidence score after NMS */
  confidence: number;
  bbox: {
    /** top-left x in original image space (px) */
    x: number;
    /** top-left y in original image space (px) */
    y: number;
    w: number;
    h: number;
  };
  /** resolved HSL color from DESIGN.md severity scale */
  color: string;
}

// ─── HistoryRecord (contract C4) ────────────────────────────────────────────

export interface HistoryRecord {
  /** uuid v4 primary key */
  id: string;
  /** epoch ms — indexed for range queries */
  createdAt: number;
  /** original image stored as Blob (jpeg, ~100-500 KB after recompression) */
  imageBlob: Blob;
  /** 250×250 jpeg data URL for grid/thumbnail views */
  thumbnailDataUrl: string;
  /** NMS-filtered detections from postprocess.ts */
  detections: Detection[];
  /** wall-clock time: preprocess + infer + postprocess (ms) */
  inferenceMs: number;
  /** metadata.model.name — indexed for model-specific queries */
  modelVersion: string;
  /** optional user-editable annotation */
  notes?: string;
}

// ─── List query options ──────────────────────────────────────────────────────

export interface ListOptions {
  /** 1-based page number (default 1) */
  page?: number;
  /** records per page (default 20) */
  pageSize?: number;
  /** filter by classId values (multi-entry index) */
  classFilter?: number[];
  /** filter by severity — resolved from class metadata */
  severityFilter?: Severity[];
  /** createdAt lower bound (epoch ms, inclusive) */
  from?: number;
  /** createdAt upper bound (epoch ms, inclusive) */
  to?: number;
}

export interface ListResult {
  items: HistoryRecord[];
  total: number;
}

// ─── Aggregate result types ──────────────────────────────────────────────────

export interface AggregateStats {
  totalInspections: number;
  defectsFound: number;
  avgInferenceMs: number;
}
