/**
 * repository.test.ts — regression coverage for list() filtering.
 *
 * Regression target: the History page "defect type" filter returned ZERO rows
 * for every class. Root cause was a Dexie/IndexedDB `*detections.classId`
 * multiEntry index: IndexedDB multiEntry only spreads an array of *primitive*
 * keys, so a keyPath into objects nested in an array resolves to undefined and
 * the index is always empty. list() now filters classId in memory instead.
 *
 * These tests would fail (0 matches) against the old indexed implementation.
 */

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { CLASS_BY_ID } from "../classes";
import { db } from "../db";
import { createRecord, list } from "../repository";
import type { Detection, HistoryRecord } from "../types";

function makeDetection(classId: number): Detection {
  const cls = CLASS_BY_ID[classId];
  if (!cls) throw new Error(`unknown classId ${classId}`);
  return {
    id: `det-${classId}-${Math.random().toString(36).slice(2)}`,
    classId,
    className: cls.name,
    severity: cls.severity,
    confidence: 0.9,
    bbox: { x: 0, y: 0, w: 10, h: 10 },
    color: cls.color,
  };
}

function makeRecord(classIds: number[]): Omit<HistoryRecord, "id" | "createdAt"> {
  return {
    imageBlob: new Blob(["x"], { type: "image/jpeg" }),
    thumbnailDataUrl: "data:image/jpeg;base64,xx",
    detections: classIds.map(makeDetection),
    inferenceMs: 100,
    modelVersion: "test-model",
  };
}

describe("list() defect-class filter", () => {
  beforeEach(async () => {
    await db.records.clear();
    // 0 = Buckling, 1 = Crack
    await createRecord(makeRecord([0])); // A: Buckling only
    await createRecord(makeRecord([1, 1])); // B: Crack only
    await createRecord(makeRecord([0, 1])); // C: both
    await createRecord(makeRecord([])); // D: no detections
  });

  it("returns all records when no class filter is applied", async () => {
    const { total } = await list({});
    expect(total).toBe(4);
  });

  it("returns only records containing a detection with the requested classId", async () => {
    const { items, total } = await list({ classFilter: [1] }); // Crack
    expect(total).toBe(2); // B and C
    for (const rec of items) {
      expect(rec.detections.some((d) => d.classId === 1)).toBe(true);
    }
  });

  it("matches classId 0 (Buckling) — guards the falsy-id edge case", async () => {
    const { total } = await list({ classFilter: [0] });
    expect(total).toBe(2); // A and C
  });

  it("treats a multi-value class filter as OR across classIds", async () => {
    const { total } = await list({ classFilter: [0, 1] });
    expect(total).toBe(3); // A, B, C (not D)
  });

  it("returns no rows for a class with no matching detections", async () => {
    const { total } = await list({ classFilter: [3] }); // Hole — none seeded
    expect(total).toBe(0);
  });
});
