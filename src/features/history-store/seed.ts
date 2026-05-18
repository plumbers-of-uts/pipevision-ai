/**
 * seed.ts — First-run hydration of the Inspection History store.
 *
 * On the very first launch the store is empty. We then load the static
 * `public/seed-history/inferences.json` manifest (pre-computed offline with
 * `cnn-assignment3/src/seed_history_inferences.py`) and insert one
 * `HistoryRecord` per entry. The accompanying JPEGs in `public/seed-history/`
 * are fetched lazily and stored as Blobs in IndexedDB so the History page
 * looks populated immediately with **real** model outputs rather than mock
 * placeholders.
 *
 * Determinism — `createdAt` is spread across the last 14 days based on the
 * record's manifest index, so the timeline order is stable across runs and
 * environments. Inference numbers and detections are exactly what the model
 * produced offline; only the timestamp is fabricated.
 *
 * Seven sample frames shown in the Detect upload picker are intentionally
 * excluded from the manifest (filtered out in the Python script) to avoid
 * users seeing the same image twice.
 */

import { v4 as uuidv4 } from "uuid";

import { CLASS_BY_ID } from "./classes";
import { db } from "./db";
import type { Detection, HistoryRecord } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Vite resolves `import.meta.env.BASE_URL` at build time (e.g. "/pipevision-ai/"). */
const SEED_BASE = `${import.meta.env.BASE_URL}seed-history/`;
const MANIFEST_URL = `${SEED_BASE}inferences.json`;

/** Spread createdAt over the last 14 days for a realistic timeline. */
const SEED_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// ─── Manifest types (mirrors seed_history_inferences.py) ──────────────────────

interface ManifestDetection {
  classId: number;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  /**
   * Optional binary instance mask serialised as a PNG data URL.
   * Present when the seed manifest was produced by a segmentation model
   * (`seed_history_inferences.py` emits this from `result.masks`).
   */
  maskPng?: string;
}

interface ManifestRecord {
  slug: string;
  source: string;
  width: number;
  height: number;
  inferenceMs: number;
  detections: ManifestDetection[];
}

interface SeedManifest {
  modelVersion: string;
  generatedAt: number;
  conf: number;
  iou: number;
  records: ManifestRecord[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchManifest(): Promise<SeedManifest> {
  const res = await fetch(MANIFEST_URL, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`Failed to load seed manifest (${res.status}): ${MANIFEST_URL}`);
  }
  return (await res.json()) as SeedManifest;
}

async function fetchImage(slug: string): Promise<{ blob: Blob; dataUrl: string }> {
  const res = await fetch(`${SEED_BASE}${slug}.jpg`, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`Failed to load seed image ${slug}: HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const dataUrl = await blobToDataUrl(blob);
  return { blob, dataUrl };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function toDetection(raw: ManifestDetection): Detection | null {
  const cls = CLASS_BY_ID[raw.classId];
  if (!cls) return null;
  return {
    id: uuidv4(),
    classId: raw.classId,
    className: cls.name,
    severity: cls.severity,
    confidence: raw.confidence,
    bbox: raw.bbox,
    color: cls.color,
    ...(raw.maskPng !== undefined ? { maskPng: raw.maskPng } : {}),
  };
}

function computeCreatedAt(index: number, total: number, nowMs: number): number {
  if (total <= 1) return nowMs;
  const fraction = index / (total - 1);
  return Math.floor(nowMs - SEED_WINDOW_MS + fraction * SEED_WINDOW_MS);
}

async function buildSeedRecord(
  entry: ManifestRecord,
  index: number,
  total: number,
  nowMs: number,
  modelVersion: string,
): Promise<HistoryRecord> {
  const { blob, dataUrl } = await fetchImage(entry.slug);
  const detections = entry.detections.map(toDetection).filter((d): d is Detection => d !== null);

  return {
    id: uuidv4(),
    createdAt: computeCreatedAt(index, total, nowMs),
    imageBlob: blob,
    thumbnailDataUrl: dataUrl,
    detections,
    inferenceMs: entry.inferenceMs,
    modelVersion,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SeedResult {
  inserted: number;
  skipped: boolean;
}

export async function seedIfEmpty(): Promise<SeedResult> {
  // Seed when:
  //   - the store is completely empty (first launch), or
  //   - the store has user records but no rows from the current seed manifest
  //     (e.g., db v3 just wiped the detect-only seed and we want the seg seed).
  // User-saved inspections carry modelVersion `...-webgpu` / `...-wasm`, so
  // counting only the bare seed modelVersion isolates seed rows.
  const manifest = await fetchManifest();
  const seedCount = await db.records.where("modelVersion").equals(manifest.modelVersion).count();
  if (seedCount > 0) return { inserted: 0, skipped: true };

  const inserted = await insertSeedRecordsFromManifest(manifest);
  return { inserted, skipped: false };
}

export async function reseedDemo(): Promise<number> {
  await db.records.clear();
  const manifest = await fetchManifest();
  return insertSeedRecordsFromManifest(manifest);
}

async function insertSeedRecordsFromManifest(manifest: SeedManifest): Promise<number> {
  const nowMs = Date.now();
  const total = manifest.records.length;

  // Fetch images with bounded concurrency — first paint of the History page
  // can proceed as soon as the first few rows land.
  const batchSize = 6;
  const records: HistoryRecord[] = [];
  for (let i = 0; i < total; i += batchSize) {
    const slice = manifest.records.slice(i, i + batchSize);
    const built = await Promise.all(
      slice.map((entry, j) => buildSeedRecord(entry, i + j, total, nowMs, manifest.modelVersion)),
    );
    records.push(...built);
  }

  records.sort((a, b) => a.createdAt - b.createdAt);

  await db.transaction("rw", db.records, async () => {
    await db.records.bulkAdd(records);
  });

  return records.length;
}
