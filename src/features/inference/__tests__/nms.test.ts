import { describe, expect, it } from "vitest";

import { applyNms } from "../nms";
import type { InferenceRawDetection } from "../types";

function box(
  classId: number,
  score: number,
  x: number,
  y: number,
  w: number,
  h: number,
): InferenceRawDetection {
  return { classId, score, bbox: { x, y, w, h } };
}

describe("applyNms", () => {
  it("returns empty for empty input", () => {
    expect(applyNms([])).toEqual([]);
  });

  it("keeps the higher-score box when two of the same class overlap", () => {
    const a = box(0, 0.9, 10, 10, 100, 100);
    const b = box(0, 0.7, 20, 20, 100, 100); // ~64% IoU with a
    const out = applyNms([a, b], 0.45);
    expect(out).toHaveLength(1);
    expect(out[0]?.score).toBe(0.9);
  });

  it("keeps both boxes when they overlap but are different classes", () => {
    const a = box(0, 0.9, 10, 10, 100, 100);
    const b = box(1, 0.7, 20, 20, 100, 100); // different class — class-wise NMS keeps both
    const out = applyNms([a, b], 0.45);
    expect(out).toHaveLength(2);
  });

  it("respects the IoU threshold (no suppression below threshold)", () => {
    const a = box(0, 0.9, 0, 0, 100, 100);
    const b = box(0, 0.8, 110, 0, 100, 100); // 0 IoU
    const out = applyNms([a, b], 0.45);
    expect(out).toHaveLength(2);
  });

  it("caps survivors at maxDetections by descending score", () => {
    const detections: InferenceRawDetection[] = Array.from({ length: 5 }, (_, i) =>
      box(i, 0.5 + i * 0.1, i * 200, 0, 50, 50),
    );
    const out = applyNms(detections, 0.45, 3);
    expect(out).toHaveLength(3);
    expect(out.map((d) => d.score)).toEqual([0.9, 0.8, 0.7]);
  });

  it("suppresses transitively when three boxes chain overlap", () => {
    const a = box(0, 0.9, 0, 0, 100, 100);
    const b = box(0, 0.8, 10, 10, 100, 100); // overlaps a
    const c = box(0, 0.7, 15, 15, 100, 100); // overlaps a and b
    const out = applyNms([a, b, c], 0.45);
    expect(out).toHaveLength(1);
    expect(out[0]?.score).toBe(0.9);
  });

  it("returns global descending score order", () => {
    const dets = [
      box(0, 0.3, 0, 0, 50, 50),
      box(1, 0.9, 1000, 0, 50, 50),
      box(2, 0.6, 0, 1000, 50, 50),
    ];
    const out = applyNms(dets);
    expect(out.map((d) => d.score)).toEqual([0.9, 0.6, 0.3]);
  });
});
