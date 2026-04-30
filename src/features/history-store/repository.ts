/**
 * repository.ts — Pure CRUD and aggregate functions over the Dexie db singleton.
 *
 * Design:
 *   - Functional style: no classes, no service objects.
 *   - No side effects on module import (db connection is lazy).
 *   - All public functions return Promises; callers decide error handling.
 *   - Isolation: readwrite transactions are implicit per Dexie table method.
 *     Multi-step operations that must be atomic use db.transaction() explicitly.
 *
 * Transaction boundaries:
 *   createRecord   — single add() call; implicit readwrite transaction.
 *   deleteById     — single delete() call; implicit readwrite transaction.
 *   clearAll       — single clear() call; implicit readwrite transaction.
 *   list()         — read-only, no explicit transaction needed.
 *   aggregateByClass / aggregateStats — read-only scans; no locking required.
 *
 * Concurrency note:
 *   Browser IndexedDB is single-tab-writer by default (one origin, one DB).
 *   Multi-tab writes are serialized by the browser's IDB implementation.
 *   No additional locking is required for this application.
 */

import { v4 as uuidv4 } from "uuid";

import { CLASS_BY_ID } from "./classes";
import { db } from "./db";
import type { AggregateStats, HistoryRecord, ListOptions, ListResult, Severity } from "./types";

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * createRecord — persists a new inspection result.
 * Generates a fresh uuid v4 as primary key and uses Date.now() as createdAt.
 *
 * @param record  All HistoryRecord fields except id and createdAt.
 * @returns       The persisted record (with generated id and createdAt).
 */
export async function createRecord(
  record: Omit<HistoryRecord, "id" | "createdAt">,
): Promise<HistoryRecord> {
  const full: HistoryRecord = {
    ...record,
    id: uuidv4(),
    createdAt: Date.now(),
  };
  await db.records.add(full);
  return full;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * getById — retrieves a single record by primary key.
 * Returns undefined when the record does not exist.
 */
export async function getById(id: string): Promise<HistoryRecord | undefined> {
  return db.records.get(id);
}

/**
 * list — paginated, filterable list of history records ordered by createdAt DESC.
 *
 * Filter evaluation order (most selective first for performance):
 *   1. date range (createdAt index)
 *   2. classFilter (multi-entry index via .where('detections.classId').anyOf())
 *   3. severityFilter (in-memory, resolved from classId via CLASS_BY_ID)
 *
 * When classFilter and severityFilter are both provided, only records
 * that pass BOTH filters are returned (logical AND).
 *
 * Pagination is applied after all filters (correct total count returned).
 */
export async function list(opts: ListOptions = {}): Promise<ListResult> {
  const { page = 1, pageSize = 20, classFilter, severityFilter, from, to } = opts;

  // Collect matching record ids when using indexed class filter
  let filteredIds: Set<string> | null = null;

  if (classFilter !== undefined && classFilter.length > 0) {
    const matchingRecords = await db.records
      .where("detections.classId")
      .anyOf(classFilter)
      .primaryKeys();
    filteredIds = new Set(matchingRecords as string[]);
  }

  // Build base collection, applying date range via index when possible
  let collection = db.records.orderBy("createdAt");

  if (from !== undefined || to !== undefined) {
    if (from !== undefined && to !== undefined) {
      collection = db.records.where("createdAt").between(from, to, true, true).reverse();
    } else if (from !== undefined) {
      collection = db.records.where("createdAt").aboveOrEqual(from).reverse();
    } else if (to !== undefined) {
      collection = db.records.where("createdAt").belowOrEqual(to).reverse();
    }
  } else {
    collection = db.records.orderBy("createdAt").reverse();
  }

  // Resolve severity set for in-memory filtering
  const severitySet: Set<Severity> | null =
    severityFilter !== undefined && severityFilter.length > 0 ? new Set(severityFilter) : null;

  // Apply in-memory filters
  const allMatching = await collection.filter((record) => {
    // Class filter (via pre-computed id set)
    if (filteredIds !== null && !filteredIds.has(record.id)) {
      return false;
    }

    // Severity filter: at least one detection must match a requested severity
    if (severitySet !== null) {
      const hasSeverity = record.detections.some((det) => {
        const cls = CLASS_BY_ID[det.classId];
        return cls !== undefined && severitySet.has(cls.severity);
      });
      if (!hasSeverity) return false;
    }

    return true;
  });

  const allItems = await allMatching.toArray();
  const total = allItems.length;

  const start = (page - 1) * pageSize;
  const items = allItems.slice(start, start + pageSize);

  return { items, total };
}

/**
 * recent — returns the N most recently created records.
 * Used by the Dashboard "Recent Detections" widget.
 */
export async function recent(limit: number): Promise<HistoryRecord[]> {
  return db.records.orderBy("createdAt").reverse().limit(limit).toArray();
}

// ─── Aggregates ───────────────────────────────────────────────────────────────

/**
 * aggregateByClass — counts total detections grouped by classId.
 * Used by the "Defect Distribution" chart.
 *
 * Returns a plain Record where keys are classId (number as string key) and
 * values are the total detection count across all records.
 *
 * Example: { 0: 3, 1: 42, 2: 17, ... }
 */
export async function aggregateByClass(): Promise<Record<number, number>> {
  const counts: Record<number, number> = {};

  await db.records.each((record) => {
    for (const det of record.detections) {
      counts[det.classId] = (counts[det.classId] ?? 0) + 1;
    }
  });

  return counts;
}

/**
 * aggregateStats — computes summary statistics for Dashboard stat cards.
 *
 * - totalInspections: count of all records
 * - defectsFound: count of records with at least one detection
 * - avgInferenceMs: mean inferenceMs across all records (0 if no records)
 */
export async function aggregateStats(): Promise<AggregateStats> {
  let totalInspections = 0;
  let defectsFound = 0;
  let sumInferenceMs = 0;

  await db.records.each((record) => {
    totalInspections += 1;
    if (record.detections.length > 0) {
      defectsFound += 1;
    }
    sumInferenceMs += record.inferenceMs;
  });

  return {
    totalInspections,
    defectsFound,
    avgInferenceMs: totalInspections > 0 ? sumInferenceMs / totalInspections : 0,
  };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * deleteById — removes a single record by primary key.
 * No-op if the record does not exist.
 */
export async function deleteById(id: string): Promise<void> {
  await db.records.delete(id);
}

/**
 * clearAll — removes all records from the table.
 * Used by "Clear History" and "Reset demo data" actions.
 */
export async function clearAll(): Promise<void> {
  await db.records.clear();
}
