/**
 * catalog.ts — Real CCTV sample frames for the Detect page gallery.
 *
 * Frames are raw test-split images from the 6-class pipeline-defect segmentation
 * dataset, one clean representative per class picked by running the deployed
 * yolo26m-seg model offline (see model/seed_history_inferences.py). Files live in
 * `public/samples/` so Vite serves them directly without a fetch round-trip.
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
    id: "deformation",
    label: "Deformation",
    expectedClass: "Deformation",
    src: `${SAMPLE_BASE}deformation.jpg`,
    defectClasses: [0],
  },
  {
    id: "obstacle",
    label: "Obstacle",
    expectedClass: "Obstacle",
    src: `${SAMPLE_BASE}obstacle.jpg`,
    defectClasses: [1],
  },
  {
    id: "rupture",
    label: "Rupture",
    expectedClass: "Rupture",
    src: `${SAMPLE_BASE}rupture.jpg`,
    defectClasses: [2],
  },
  {
    id: "disconnect",
    label: "Disconnect",
    expectedClass: "Disconnect",
    src: `${SAMPLE_BASE}disconnect.jpg`,
    defectClasses: [3],
  },
  {
    id: "misalignment",
    label: "Misalignment",
    expectedClass: "Misalignment",
    src: `${SAMPLE_BASE}misalignment.jpg`,
    defectClasses: [4],
  },
  {
    id: "deposition",
    label: "Deposition",
    expectedClass: "Deposition",
    src: `${SAMPLE_BASE}deposition.jpg`,
    defectClasses: [5],
  },
];
