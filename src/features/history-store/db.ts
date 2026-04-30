/**
 * db.ts — Dexie schema definition (IndexedDB, schema version 1).
 *
 * Schema layers:
 *   External  — HistoryRecord interface (see types.ts)
 *   Conceptual — single "records" object store keyed by uuid v4
 *   Internal  — Dexie manages IDBObjectStore; indexes defined below
 *
 * Indexes:
 *   createdAt      — range queries for date-based pagination and "recent" widget
 *   modelVersion   — filter/group by model version on the Models page
 *   *detections.classId — multi-entry index for class-based filtering (C4 contract)
 *
 * ACID expectations:
 *   IndexedDB provides snapshot isolation per transaction.
 *   All writes use Dexie's auto-transacted table methods (add/put/delete) which
 *   wrap each call in an implicit readwrite transaction — sufficient for single-user
 *   browser-side storage with no concurrent writers.
 *
 * Migration path:
 *   Increment the version number and chain `.version(N).stores({...}).upgrade(tx => ...)`
 *   when the schema changes. Dexie handles IDB `onupgradeneeded` automatically.
 *   Breaking changes (e.g., removing indexed fields) require an explicit upgrade callback.
 *
 * Example future migration:
 *   db.version(2).stores({
 *     records: 'id, createdAt, modelVersion, *detections.classId, locationTag',
 *   }).upgrade(async tx => {
 *     await tx.table('records').toCollection().modify({ locationTag: null });
 *   });
 */

import Dexie, { type EntityTable } from "dexie";

import type { HistoryRecord } from "./types";

class PipeVisionDatabase extends Dexie {
  records!: EntityTable<HistoryRecord, "id">;

  constructor() {
    super("pipevision-db");

    /**
     * Version 1 — initial schema.
     *
     * Index spec (Dexie shorthand):
     *   id                   → primary key (explicit, string uuid)
     *   createdAt            → B-tree index for date range & ordering
     *   modelVersion         → B-tree index for model-specific aggregation
     *   *detections.classId  → multi-entry index (one entry per Detection in array)
     *
     * Fields NOT indexed (stored only): imageBlob, thumbnailDataUrl,
     *   detections[].* (except classId), inferenceMs, notes.
     */
    this.version(1).stores({
      records: "id, createdAt, modelVersion, *detections.classId",
    });
  }
}

/**
 * db — singleton Dexie instance.
 * Import this wherever IndexedDB access is needed.
 * The connection is lazy-opened on first operation.
 */
export const db = new PipeVisionDatabase();
