/**
 * classes.ts — PipeVision class metadata constant.
 *
 * Matches contract C2 (metadata.yaml) exactly:
 *   classes[id].name and severity are the canonical source of truth.
 *
 * Colors follow DESIGN.md severity scale (HSL tokens):
 *   critical → hsl(0 72% 45%)   (red)
 *   high     → hsl(20 85% 46%)  (orange)
 *   medium   → hsl(40 90% 38%)  (amber)
 *   low      → hsl(160 55% 38%) (teal-green)
 *
 * This file has NO Dexie dependency so it can be imported freely by UI components.
 */

import type { Severity } from "./types";

export interface ClassMeta {
  readonly id: number;
  readonly name: string;
  readonly severity: Severity;
  readonly color: string;
}

export const PIPEVISION_CLASSES = [
  { id: 0, name: "Deformation", severity: "high" as const, color: "hsl(20, 85%, 46%)" },
  { id: 1, name: "Obstacle", severity: "high" as const, color: "hsl(20, 85%, 46%)" },
  { id: 2, name: "Rupture", severity: "critical" as const, color: "hsl(0, 72%, 45%)" },
  { id: 3, name: "Disconnect", severity: "critical" as const, color: "hsl(0, 72%, 45%)" },
  { id: 4, name: "Misalignment", severity: "medium" as const, color: "hsl(40, 90%, 38%)" },
  { id: 5, name: "Deposition", severity: "low" as const, color: "hsl(160, 55%, 38%)" },
] as const satisfies readonly ClassMeta[];

/** Total number of classes (6). */
export const CLASS_COUNT = PIPEVISION_CLASSES.length;

/** Convenience lookup: classId → ClassMeta. O(1). */
export const CLASS_BY_ID: Readonly<Record<number, ClassMeta>> = Object.fromEntries(
  PIPEVISION_CLASSES.map((c) => [c.id, c]),
);
