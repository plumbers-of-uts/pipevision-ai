/**
 * seed.ts — Demo data generation for the PipeVision history store.
 *
 * Generates ~50 realistic HistoryRecord entries spread over the last 14 days.
 * Uses a deterministic pseudo-random number generator (Mulberry32) so every run
 * produces identical records — ensuring stable screenshots and test snapshots.
 *
 * Class distribution mirrors the PDF dataset long-tail (22.5:1):
 *   Crack (1)             40%  — dominant class, matches 696 training instances
 *   Joint offset (4)      18%  — second most frequent
 *   Utility intrusion (6) 14%
 *   Debris (2)            10%
 *   Obstacle (5)           9%
 *   Buckling (0)           7%
 *   Hole (3)               2%  — rarest class
 *   Clean pipes            ~5% (records with NO detections — demo realism)
 *
 * imageBlob / thumbnailDataUrl:
 *   A 200×200 SVG placeholder is generated for each record. The SVG depicts a
 *   stylised circular pipe cross-section with a coloured interior tint matching
 *   the severity colour of the dominant detection class (or neutral grey for
 *   clean pipes). This makes thumbnails visually distinguishable without using
 *   real photographs (copyright concern + storage size).
 *
 *   The SVG string is base64-encoded as `data:image/svg+xml;base64,...`.
 *   The same data URL is used for both `imageBlob` (converted to Blob) and
 *   `thumbnailDataUrl` because at 200×200 the SVG is small enough (<2 KB).
 */

import { v4 as uuidv4 } from "uuid";

import { CLASS_BY_ID, PIPEVISION_CLASSES } from "./classes";
import { db } from "./db";
import type { Detection, HistoryRecord } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Model version string — must match metadata.yaml model.name (C2 contract). */
const SEED_MODEL_VERSION = "yolo26m-pipevision-fp16";

/** Total number of seeded records. */
const SEED_COUNT = 50;

/** Window in which records are spread (14 days in ms). */
const SEED_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** Canvas dimensions used to generate bounding boxes. */
const CANVAS_W = 640;
const CANVAS_H = 480;

/** Fixed seed for the Mulberry32 PRNG — do not change (snapshot stability). */
const RNG_SEED = 0xdeadbeef;

// ─── Deterministic PRNG (Mulberry32) ─────────────────────────────────────────

/**
 * mulberry32 — simple 32-bit PRNG.
 * Returns a function that yields uniformly distributed floats in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

// ─── Class distribution weights ───────────────────────────────────────────────

/**
 * Weighted class selection table.
 * Weights are proportional to the long-tail distribution described above.
 * Cumulative probabilities are pre-computed for O(1) lookup.
 *
 * The "clean" entry (id: -1) represents a record with no detections.
 */
interface WeightEntry {
  classId: number; // -1 = clean pipe (no defects)
  weight: number;
}

const CLASS_WEIGHTS: WeightEntry[] = [
  { classId: 1, weight: 40 }, // Crack
  { classId: 4, weight: 18 }, // Joint offset
  { classId: 6, weight: 14 }, // Utility intrusion
  { classId: 2, weight: 10 }, // Debris
  { classId: 5, weight: 9 }, //  Obstacle
  { classId: 0, weight: 7 }, //  Buckling
  { classId: 3, weight: 2 }, //  Hole
  { classId: -1, weight: 5 }, // Clean pipe (no detections)
];

const TOTAL_WEIGHT = CLASS_WEIGHTS.reduce((s, e) => s + e.weight, 0);

/** Pre-computed cumulative weights for weighted random selection. */
const CUMULATIVE_WEIGHTS: number[] = (() => {
  const out: number[] = [];
  let acc = 0;
  for (const e of CLASS_WEIGHTS) {
    acc += e.weight;
    out.push(acc);
  }
  return out;
})();

/** Pick a primary classId (-1 = clean) using the weighted distribution. */
function pickPrimaryClass(rand: () => number): number {
  const r = rand() * TOTAL_WEIGHT;
  for (let i = 0; i < CUMULATIVE_WEIGHTS.length; i++) {
    const cw = CUMULATIVE_WEIGHTS[i];
    if (cw !== undefined && r < cw) {
      const entry = CLASS_WEIGHTS[i];
      return entry !== undefined ? entry.classId : -1;
    }
  }
  return -1;
}

// ─── Detection generation ─────────────────────────────────────────────────────

/**
 * generateDetections — creates 1-4 Detection objects for a single record.
 * If primaryClassId is -1, returns an empty array (clean pipe).
 *
 * Bounding boxes are spread across the 640×480 canvas using the PRNG.
 * Confidence values are sampled from 0.30 to 0.95.
 */
function generateDetections(primaryClassId: number, rand: () => number): Detection[] {
  if (primaryClassId === -1) return [];

  // 1-4 detections, with the primary class guaranteed as the first
  const count = 1 + Math.floor(rand() * 4);
  const detections: Detection[] = [];

  for (let i = 0; i < count; i++) {
    // First detection uses the primary class; subsequent ones are random
    let classId: number;
    if (i === 0) {
      classId = primaryClassId;
    } else {
      // Additional detections: random class (may repeat primary — realistic)
      classId = Math.floor(rand() * PIPEVISION_CLASSES.length);
    }

    const cls = CLASS_BY_ID[classId];
    if (cls === undefined) continue;

    // Bounding box: random top-left with constrained width/height
    const bw = 40 + Math.floor(rand() * 160); // 40–200 px wide
    const bh = 30 + Math.floor(rand() * 120); // 30–150 px tall
    const bx = Math.floor(rand() * (CANVAS_W - bw));
    const by = Math.floor(rand() * (CANVAS_H - bh));

    // Confidence: primary class gets higher range (0.50–0.95), extras (0.30–0.80)
    const confMin = i === 0 ? 0.5 : 0.3;
    const confRange = i === 0 ? 0.45 : 0.5;
    const confidence = Math.round((confMin + rand() * confRange) * 100) / 100;

    detections.push({
      id: uuidv4(),
      classId,
      className: cls.name,
      severity: cls.severity,
      confidence,
      bbox: { x: bx, y: by, w: bw, h: bh },
      color: cls.color,
    });
  }

  return detections;
}

// ─── SVG thumbnail generation ─────────────────────────────────────────────────

/**
 * hslToHex — convert an HSL string like "hsl(20 85% 46%)" to a hex colour.
 * Used to embed literal hex values inside SVG attributes.
 */
function hslToHex(hsl: string): string {
  // Parse "hsl(H S% L%)" — space-separated modern CSS syntax
  const m = hsl.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/);
  if (!m) return "#888888";

  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const hue2rgb = (t: number): number => {
    const tc = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tc < 1 / 6) return p + (q - p) * 6 * tc;
    if (tc < 1 / 2) return q;
    if (tc < 2 / 3) return p + (q - p) * (2 / 3 - tc) * 6;
    return p;
  };

  const r = Math.round(hue2rgb(h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(h) * 255);
  const b = Math.round(hue2rgb(h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * buildSvgDataUrl — generates a 200×200 SVG pipe thumbnail.
 *
 * Visual structure:
 *   - Dark grey rectangular background (pipe conduit exterior)
 *   - Circular pipe cross-section with a tinted interior fill
 *   - Concentric ring suggesting pipe wall thickness
 *   - Small label at bottom showing class name (or "Clean" for no detections)
 *
 * @param tintHsl  HSL colour string for the pipe interior fill.
 * @param label    Text label displayed at the bottom of the SVG.
 */
function buildSvgDataUrl(tintHsl: string, label: string): string {
  const tintHex = hslToHex(tintHsl);

  // Semi-transparent version for the pipe wall gradient
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <title>${label}</title>
  <rect width="200" height="200" fill="#1a1f2e"/>
  <rect x="10" y="10" width="180" height="180" rx="4" fill="#0f1420" stroke="#2a3040" stroke-width="1"/>
  <!-- Outer pipe ring -->
  <circle cx="100" cy="95" r="70" fill="#2a3040" stroke="#3a4560" stroke-width="2"/>
  <!-- Pipe wall -->
  <circle cx="100" cy="95" r="62" fill="#1e2535"/>
  <!-- Pipe interior with severity tint -->
  <circle cx="100" cy="95" r="52" fill="${tintHex}" fill-opacity="0.35"/>
  <!-- Inner shadow ring -->
  <circle cx="100" cy="95" r="52" fill="none" stroke="${tintHex}" stroke-width="3" stroke-opacity="0.6"/>
  <!-- Centre highlight -->
  <circle cx="100" cy="95" r="20" fill="${tintHex}" fill-opacity="0.12"/>
  <!-- Label background -->
  <rect x="20" y="168" width="160" height="22" rx="3" fill="#0f1420" fill-opacity="0.85"/>
  <!-- Label text -->
  <text x="100" y="183" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="${tintHex}" font-weight="600">${label}</text>
</svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * dataUrlToBlob — converts a base64 data URL to a Blob.
 * Used to populate the imageBlob field of HistoryRecord.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  if (!header || !base64) throw new Error("Invalid data URL");

  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch?.[1] ?? "image/svg+xml";

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

// ─── Record builder ───────────────────────────────────────────────────────────

/**
 * buildSeedRecord — constructs a single HistoryRecord for the given index.
 * The index and PRNG state together determine all fields deterministically.
 *
 * @param index     0-based record index within the seed batch.
 * @param nowMs     Current epoch ms — records are spread over [now-14d, now].
 * @param rand      Stateful PRNG function.
 */
function buildSeedRecord(
  index: number,
  nowMs: number,
  rand: () => number,
): Omit<HistoryRecord, "id" | "createdAt"> & { createdAt: number; id: string } {
  // Spread createdAt evenly across the 14-day window with slight jitter
  const baseSpread = (index / SEED_COUNT) * SEED_WINDOW_MS;
  const jitter = rand() * (SEED_WINDOW_MS / SEED_COUNT) * 0.5;
  const createdAt = Math.floor(nowMs - SEED_WINDOW_MS + baseSpread + jitter);

  // Primary class determines the dominant defect type for this record
  const primaryClassId = pickPrimaryClass(rand);
  const detections = generateDetections(primaryClassId, rand);

  // Thumbnail: tint from dominant class colour, or neutral for clean pipes
  let tintHsl: string;
  let label: string;
  if (primaryClassId === -1 || detections.length === 0) {
    tintHsl = "hsl(220 20% 45%)"; // neutral blue-grey for clean pipes
    label = "Clean";
  } else {
    const cls = CLASS_BY_ID[primaryClassId];
    tintHsl = cls?.color ?? "hsl(220 20% 45%)";
    label = cls?.name ?? "Unknown";
  }

  const thumbnailDataUrl = buildSvgDataUrl(tintHsl, label);
  const imageBlob = dataUrlToBlob(thumbnailDataUrl);

  // inferenceMs: 800-3500 ms (WebGPU desktop range with some WASM outliers)
  const inferenceMs = Math.floor(800 + rand() * 2700);

  return {
    id: uuidv4(),
    createdAt,
    imageBlob,
    thumbnailDataUrl,
    detections,
    inferenceMs,
    modelVersion: SEED_MODEL_VERSION,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SeedResult {
  inserted: number;
  skipped: boolean;
}

/**
 * seedIfEmpty — inserts ~50 demo records if the store is currently empty.
 *
 * Returns `{ inserted: N, skipped: false }` after insertion, or
 * `{ inserted: 0, skipped: true }` if records already exist.
 *
 * Safe to call multiple times (idempotent when non-empty).
 */
export async function seedIfEmpty(): Promise<SeedResult> {
  const count = await db.records.count();
  if (count > 0) {
    return { inserted: 0, skipped: true };
  }

  const inserted = await _insertSeedRecords();
  return { inserted, skipped: false };
}

/**
 * reseedDemo — clears all existing records and inserts fresh demo data.
 * Intended for a future "Reset demo data" button.
 *
 * @returns Number of inserted records.
 */
export async function reseedDemo(): Promise<number> {
  await db.records.clear();
  return _insertSeedRecords();
}

/**
 * _insertSeedRecords — internal helper that performs the actual bulk insert.
 * Uses db.transaction() to wrap all adds in a single readwrite transaction
 * for atomicity and performance (one IDB transaction vs. N implicit ones).
 */
async function _insertSeedRecords(): Promise<number> {
  const rand = mulberry32(RNG_SEED);
  const nowMs = Date.now();

  const records: HistoryRecord[] = [];
  for (let i = 0; i < SEED_COUNT; i++) {
    const record = buildSeedRecord(i, nowMs, rand);
    records.push(record);
  }

  // Sort by createdAt ASC before inserting (consistent ordering in DB)
  records.sort((a, b) => a.createdAt - b.createdAt);

  await db.transaction("rw", db.records, async () => {
    await db.records.bulkAdd(records);
  });

  return records.length;
}
