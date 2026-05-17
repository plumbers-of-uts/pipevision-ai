/**
 * catalog.ts — Real CCTV sample frames for the Detect page gallery.
 *
 * Frames are raw test-split images from the Roboflow Sewage Defect Detection
 * dataset (sewage-yolo26 / test / images), one per class chosen from the
 * model's strongest qualitative predictions. Files live in `public/samples/`
 * so Vite serves them directly without a fetch round-trip through the bundler.
 */

export interface SampleImage {
  id: string;
  label: string;
  expectedClass: string;
  src: string;
  /** Defect class IDs present in this frame (informational; inference is live). */
  defectClasses: number[];
}

/** Vite serves public/ under `import.meta.env.BASE_URL` (e.g. "/pipevision-ai/"). */
const SAMPLE_BASE = `${import.meta.env.BASE_URL}samples/`;

export const SAMPLE_CATALOG: SampleImage[] = [
  {
    id: "utility-intrusion",
    label: "Utility intrusion",
    expectedClass: "Utility intrusion",
    src: `${SAMPLE_BASE}utility-intrusion.jpg`,
    defectClasses: [6],
  },
  {
    id: "hole",
    label: "Hole",
    expectedClass: "Hole",
    src: `${SAMPLE_BASE}hole.jpg`,
    defectClasses: [3],
  },
  {
    id: "obstacle",
    label: "Obstacle",
    expectedClass: "Obstacle",
    src: `${SAMPLE_BASE}obstacle.jpg`,
    defectClasses: [5],
  },
  {
    id: "debris",
    label: "Debris",
    expectedClass: "Debris",
    src: `${SAMPLE_BASE}debris.jpg`,
    defectClasses: [2],
  },
  {
    id: "crack",
    label: "Crack",
    expectedClass: "Crack",
    src: `${SAMPLE_BASE}crack.jpg`,
    defectClasses: [1],
  },
  {
    id: "joint-offset",
    label: "Joint offset",
    expectedClass: "Joint offset",
    src: `${SAMPLE_BASE}joint-offset.jpg`,
    defectClasses: [4],
  },
  {
    id: "buckling",
    label: "Buckling",
    expectedClass: "Buckling",
    src: `${SAMPLE_BASE}buckling.jpg`,
    defectClasses: [0],
  },
];
