/**
 * migrate-thumbnails.ts — One-shot migration that bakes detection overlays
 * into HistoryRecord.thumbnailDataUrl for legacy rows.
 *
 * The annotated-thumbnail logic in detect-page only runs at the moment a new
 * detection is created. Records that were saved before that change (and every
 * row produced by `seed.ts`) keep the raw source image as their thumbnail, so
 * the history grid and detail modal show no segmentation / bbox overlay.
 *
 * This migration walks the store and, for every record whose thumbnail is not
 * already a webp overlay (the format the new compositor emits) and that has
 * detections + an imageBlob, regenerates the thumbnail via
 * `composeAnnotatedImage` and persists it.
 *
 * Idempotent: detecting `data:image/webp` as the prefix means re-running the
 * migration after every record has been baked is a no-op.
 */

import { composeAnnotatedImage } from "@/features/inference/annotate-image";

import { db } from "./db";

const BAKED_PREFIX = "data:image/webp";

export interface ThumbnailMigrationResult {
  baked: number;
  skipped: number;
  failed: number;
}

/**
 * Walk every record and bake an annotated thumbnail when missing. Failures on
 * individual rows are logged but never thrown — partial progress is preferable
 * to aborting the whole migration when one record's image blob is corrupted.
 */
export async function bakeLegacyThumbnails(): Promise<ThumbnailMigrationResult> {
  const ids = (await db.records.toCollection().primaryKeys()) as string[];
  let baked = 0;
  let skipped = 0;
  let failed = 0;

  for (const id of ids) {
    const record = await db.records.get(id);
    if (!record) continue;

    if (record.thumbnailDataUrl.startsWith(BAKED_PREFIX)) {
      skipped++;
      continue;
    }
    if (record.detections.length === 0) {
      // Nothing to draw — keep the raw thumbnail as-is.
      skipped++;
      continue;
    }
    if (!(record.imageBlob instanceof Blob) || record.imageBlob.size === 0) {
      skipped++;
      continue;
    }

    try {
      const annotated = await composeAnnotatedImage(record.imageBlob, record.detections);
      await db.records.update(id, { thumbnailDataUrl: annotated });
      baked++;
    } catch (err) {
      console.warn("[migrate-thumbnails] bake failed for record", id, err);
      failed++;
    }
  }

  return { baked, skipped, failed };
}
