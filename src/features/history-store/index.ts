/**
 * index.ts — Public API surface for the history-store feature.
 *
 * Import from this barrel file in all consumer features and components.
 * Do NOT import directly from db.ts, repository.ts, seed.ts, or classes.ts
 * outside of the feature directory — this enforces the FSD-lite boundary.
 */

// Database singleton
export { db } from "./db";

// Repository — CRUD and aggregate functions
export {
  aggregateByClass,
  aggregateStats,
  clearAll,
  createRecord,
  deleteById,
  getById,
  list,
  recent,
} from "./repository";

// Types (re-exported for consumer convenience)
export type {
  AggregateStats,
  Detection,
  HistoryRecord,
  ListOptions,
  ListResult,
  Severity,
} from "./types";

// Class metadata constant (no Dexie dependency)
export { CLASS_BY_ID, CLASS_COUNT, PIPEVISION_CLASSES } from "./classes";
export type { ClassMeta } from "./classes";

// Seed functions
export { reseedDemo, seedIfEmpty } from "./seed";
export type { SeedResult } from "./seed";
