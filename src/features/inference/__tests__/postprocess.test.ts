import { describe, expect, it } from "vitest";

import { decodeYoloOutput, detectLayout, unletterboxBoxes } from "../postprocess";
import type { LetterboxResult } from "../preprocess";
import type { InferenceRawDetection } from "../types";

describe("detectLayout", () => {
  it("detects nc-first when dims[1] === 4 + numClasses", () => {
    expect(detectLayout([1, 11, 8400], 7)).toBe("nc-first");
  });

  it("detects nc-last when dims[2] === 4 + numClasses", () => {
    expect(detectLayout([1, 8400, 11], 7)).toBe("nc-last");
  });

  it("detects nms-included when dims[2] === 6 + maskChannels", () => {
    expect(detectLayout([1, 300, 38], 7, 32)).toBe("nms-included");
    expect(detectLayout([1, 300, 6], 7, 0)).toBe("nms-included");
  });

  it("throws on unexpected dims", () => {
    expect(() => detectLayout([1, 13, 8400], 7)).toThrow();
    expect(() => detectLayout([1, 8400], 7)).toThrow();
  });
});

describe("decodeYoloOutput", () => {
  // Build a tiny synthetic output: 1 anchor, 2 classes, single high-score class
  // dims = [1, 6, 1]  → nc-first
  // channels: [cx, cy, w, h, class0, class1]
  const numClasses = 2;
  const cx = 0.5;
  const cy = 0.5;
  const w = 0.2;
  const h = 0.2;
  const class0Score = 0.1;
  const class1Score = 0.95;

  it("decodes nc-first layout and picks the highest-scoring class", () => {
    const data = new Float32Array([cx, cy, w, h, class0Score, class1Score]);
    const out = decodeYoloOutput({ data, dims: [1, 6, 1] }, 0.25, numClasses, "nc-first");
    expect(out).toHaveLength(1);
    const det = out[0];
    expect(det?.classId).toBe(1);
    expect(det?.score).toBeCloseTo(0.95);
    expect(det?.bbox.x).toBeCloseTo(cx);
    expect(det?.bbox.y).toBeCloseTo(cy);
    expect(det?.bbox.w).toBeCloseTo(w);
    expect(det?.bbox.h).toBeCloseTo(h);
  });

  it("decodes nc-last layout equivalently", () => {
    // Same content, transposed: dims [1, 1, 6]
    const data = new Float32Array([cx, cy, w, h, class0Score, class1Score]);
    const out = decodeYoloOutput({ data, dims: [1, 1, 6] }, 0.25, numClasses, "nc-last");
    expect(out).toHaveLength(1);
    expect(out[0]?.classId).toBe(1);
  });

  it("drops detections below the confidence threshold", () => {
    const data = new Float32Array([cx, cy, w, h, 0.1, 0.2]);
    const out = decodeYoloOutput({ data, dims: [1, 6, 1] }, 0.5, numClasses, "nc-first");
    expect(out).toEqual([]);
  });

  it("filters NaN coordinates silently", () => {
    const data = new Float32Array([Number.NaN, cy, w, h, class0Score, class1Score]);
    const out = decodeYoloOutput({ data, dims: [1, 6, 1] }, 0.25, numClasses, "nc-first");
    expect(out).toEqual([]);
  });

  it("decodes nms-included seg output and converts xyxy(640px) → cxcywh(norm)", () => {
    // One real detection + one padding row (conf 0).
    // cols = 6 + 32 = 38, two rows → dims [1, 2, 38]
    const inputSize = 640;
    const cols = 6 + 32;
    const data = new Float32Array(2 * cols);
    // Row 0: x1=160, y1=160, x2=480, y2=480 → centre image, half-size box
    data[0] = 160;
    data[1] = 160;
    data[2] = 480;
    data[3] = 480;
    data[4] = 0.9; // conf
    data[5] = 3; // class id
    // mask coeffs left as zeros — fine for this test.
    // Row 1: padding — already zeros, conf=0 → dropped.

    const out = decodeYoloOutput(
      { data, dims: [1, 2, cols] },
      0.25,
      7,
      "nms-included",
      32,
      inputSize,
    );
    expect(out).toHaveLength(1);
    const det = out[0];
    expect(det?.classId).toBe(3);
    expect(det?.score).toBeCloseTo(0.9);
    expect(det?.bbox.x).toBeCloseTo(0.5);
    expect(det?.bbox.y).toBeCloseTo(0.5);
    expect(det?.bbox.w).toBeCloseTo(320 / 640);
    expect(det?.bbox.h).toBeCloseTo(320 / 640);
    expect(det?.coeffs?.length).toBe(32);
    expect(det?.bbox640Norm?.x).toBeCloseTo(0.5);
  });
});

describe("unletterboxBoxes", () => {
  it("inverts a centred letterbox transform back to original pixel space", () => {
    // Original image 100×200, scaled into 640×640 with scale = 3.2 (640/200)
    // → bitmap fits at 320×640 with padX = (640-320)/2 = 160, padY = 0
    const lb: LetterboxResult = {
      tensor: new Float32Array(0), // not used here
      scale: 640 / 200,
      padX: 160,
      padY: 0,
      bitmapWidth: 100,
      bitmapHeight: 200,
    };

    // Detection centred in the original image, half-width
    // In normalised 640-space:
    //   cx_orig_px = 50, cy_orig_px = 100, w_orig_px = 50, h_orig_px = 100
    //   cx_640_px = 50 * scale + padX = 50 * 3.2 + 160 = 320
    //   cy_640_px = 100 * scale + padY = 100 * 3.2 + 0 = 320
    //   w_640_px = 50 * 3.2 = 160; h_640_px = 100 * 3.2 = 320
    // Normalised to [0,1]: divide by 640
    const det: InferenceRawDetection = {
      classId: 0,
      score: 0.9,
      bbox: { x: 320 / 640, y: 320 / 640, w: 160 / 640, h: 320 / 640 },
    };

    const out = unletterboxBoxes([det], lb);
    expect(out).toHaveLength(1);
    const b = out[0]?.bbox;
    // Allow ±1 px rounding tolerance
    expect(b?.x).toBeGreaterThanOrEqual(24);
    expect(b?.x).toBeLessThanOrEqual(26);
    expect(b?.y).toBeGreaterThanOrEqual(49);
    expect(b?.y).toBeLessThanOrEqual(51);
    expect(b?.w).toBe(50);
    expect(b?.h).toBe(100);
  });

  it("clamps boxes that would extend past the image edge", () => {
    const lb: LetterboxResult = {
      tensor: new Float32Array(0),
      scale: 1,
      padX: 0,
      padY: 0,
      bitmapWidth: 640,
      bitmapHeight: 640,
    };
    // Box centred on the right edge with a width that exceeds the image
    const det: InferenceRawDetection = {
      classId: 0,
      score: 0.9,
      bbox: { x: 1.0, y: 0.5, w: 0.5, h: 0.1 },
    };
    const out = unletterboxBoxes([det], lb);
    expect(out[0]?.bbox.x).toBeGreaterThanOrEqual(0);
    expect((out[0]?.bbox.x ?? 0) + (out[0]?.bbox.w ?? 0)).toBeLessThanOrEqual(640);
  });
});
