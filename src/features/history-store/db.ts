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
 *   *detections.classId — declared but effectively EMPTY (see warning below);
 *                         class filtering is done in memory in repository.list()
 *
 * WARNING — do NOT query `*detections.classId` as a class filter. IndexedDB
 * multiEntry only spreads an array of *primitive* keys; a keyPath into objects
 * nested in an array (`detections.classId`) resolves to undefined, so the index
 * receives no entries and `.where('detections.classId').anyOf(...)` returns zero
 * rows for every class. The index is retained only to avoid a schema-version
 * migration; repository.list() filters classId in memory instead.
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
     *   *detections.classId  → empty in practice (IndexedDB cannot multiEntry a
     *                          sub-property of objects in an array); see header
     *                          warning. Class filtering happens in memory.
     *
     * Fields NOT indexed (stored only): imageBlob, thumbnailDataUrl,
     *   detections[].* (except classId), inferenceMs, notes.
     */
    this.version(1).stores({
      records: "id, createdAt, modelVersion, *detections.classId",
    });

    /**
     * Version 2 — drop the legacy SVG placeholder seed so the new real-CCTV
     * seed (`seed.ts`) can repopulate on next launch. Real user-saved
     * inspections are preserved: only records whose thumbnail is an inline
     * SVG data URL are removed.
     */
    this.version(2)
      .stores({
        records: "id, createdAt, modelVersion, *detections.classId",
      })
      .upgrade(async (tx) => {
        await tx
          .table<HistoryRecord, string>("records")
          .filter((r) => r.thumbnailDataUrl?.startsWith("data:image/svg") ?? false)
          .delete();
      });

    /**
     * Version 3 — drop the detect-only seed (modelVersion exactly
     * "yolo26m-pipevision-fp16"). The seed manifest now ships from the seg
     * model with maskPng baked in, so the old mask-less rows have to go
     * before `seedIfEmpty` can reinsert the new manifest. User-saved
     * inspections carry a backend suffix (e.g. "...-webgpu", "...-wasm") so
     * they are not touched.
     */
    this.version(3)
      .stores({
        records: "id, createdAt, modelVersion, *detections.classId",
      })
      .upgrade(async (tx) => {
        await tx
          .table<HistoryRecord, string>("records")
          .where("modelVersion")
          .equals("yolo26m-pipevision-fp16")
          .delete();
      });
  }
}

/**
 * db — singleton Dexie instance.
 * Import this wherever IndexedDB access is needed.
 * The connection is lazy-opened on first operation.
 */
export const db = new PipeVisionDatabase();
