/**
 * detect-page.tsx — Defect Detection page.
 *
 * Workflow:
 *   1. User picks an image (dropzone or sample button)
 *   2. "Run Detection" triggers mock inference: 1.5s delay → generate 1-3 fake
 *      detections → draw bboxes on canvas → save record to IndexedDB
 *   3. Results panel shows detections + pipe condition grade
 *   4. "Upload New" resets to dropzone state
 *
 * Sprint 3 TODO: Replace runMockInference() with real ONNX Runtime Web call.
 * The mock generator is the only stub — everything else (canvas, record save,
 * result panel) is production-ready wiring.
 *
 * Matches gui-mockup.html #page-detect (lines 926-1176).
 */

"use client";

import { ArrowLeft, CheckSquare, Cpu, Play } from "lucide-react";
import { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import { PIPEVISION_CLASSES } from "@/features/history-store/classes";
import { createRecord } from "@/features/history-store/repository";
import type { Detection, HistoryRecord } from "@/features/history-store/types";
import type { SampleImage } from "@/features/samples/catalog";
import { SAMPLE_CATALOG } from "@/features/samples/catalog";
import { DetectionCanvas } from "@/widgets/detection-canvas";
import { DetectionResultPanel } from "@/widgets/detection-result-panel";
import { ImageDropzone } from "@/widgets/image-dropzone";

// ─── Canvas dimensions for bbox generation ────────────────────────────────────
const IMG_W = 640;
const IMG_H = 480;

// ─── Mock inference ───────────────────────────────────────────────────────────

/**
 * runMockInference — stub for Sprint 3.
 *
 * TODO (Sprint 3): Replace this entire function with a real ORT InferenceSession call.
 * The function signature (accepts defectClassIds hint) and return type (Detection[]) must stay.
 *
 * Generates 1-3 random detections using the provided class ids as primary hints.
 * Confidence: 0.50–0.95 range. Bbox: random within 640×480 space.
 */
function runMockInference(defectClassIds: number[]): Detection[] {
  const count = Math.min(defectClassIds.length, 1 + Math.floor(Math.random() * 3));
  const detections: Detection[] = [];

  for (let i = 0; i < count; i++) {
    const rawClassId = defectClassIds[i] ?? Math.floor(Math.random() * PIPEVISION_CLASSES.length);
    const classId = rawClassId % PIPEVISION_CLASSES.length;
    const cls = PIPEVISION_CLASSES[classId];
    if (!cls) continue;

    const bw = 60 + Math.floor(Math.random() * 160);
    const bh = 50 + Math.floor(Math.random() * 120);
    const bx = Math.floor(Math.random() * (IMG_W - bw));
    const by = Math.floor(Math.random() * (IMG_H - bh));
    const confidence = Math.round((0.5 + Math.random() * 0.45) * 100) / 100;

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

/** Convert a data URL string to a Blob. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header?.match(/:(.*?);/)?.[1] ?? "image/svg+xml";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// ─── Upload guidelines ────────────────────────────────────────────────────────

const GUIDELINES = [
  { ok: true, text: "Minimum resolution 640×480px for accurate detection" },
  { ok: true, text: "Ensure adequate lighting; overexposed areas reduce accuracy" },
  { ok: true, text: "Frontal or axial pipe view preferred over angled shots" },
  { ok: false, text: "Avoid heavily motion-blurred or compressed images" },
];

// ─── Component ────────────────────────────────────────────────────────────────

type PageState = "upload" | "processing" | "results";

export function DetectPage() {
  const [pageState, setPageState] = useState<PageState>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSample, setSelectedSample] = useState<SampleImage | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [inferenceMs, setInferenceMs] = useState(0);
  const [savedRecord, setSavedRecord] = useState<HistoryRecord | null>(null);

  const objectUrlRef = useRef<string | null>(null);

  function clearObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function handleFileAccepted(file: File) {
    clearObjectUrl();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setSelectedFile(file);
    setSelectedSample(null);
    setImageUrl(url);
  }

  function handleSampleSelect(sample: SampleImage) {
    clearObjectUrl();
    setSelectedSample(sample);
    setSelectedFile(null);
    setImageUrl(sample.dataUrl);
  }

  async function handleRunDetection() {
    if (!imageUrl) return;
    setPageState("processing");

    const startMs = Date.now();

    // 1.5s simulated inference delay
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    // Generate mock detections
    const classHints = selectedSample?.defectClasses ?? PIPEVISION_CLASSES.map((c) => c.id);
    const dets = runMockInference(classHints);
    const elapsed = Date.now() - startMs;

    // Build image blob for IndexedDB
    let blob: Blob;
    let thumbUrl: string;

    if (selectedFile) {
      blob = selectedFile;
      thumbUrl = imageUrl;
    } else if (selectedSample) {
      blob = dataUrlToBlob(selectedSample.dataUrl);
      thumbUrl = selectedSample.dataUrl;
    } else {
      blob = new Blob([], { type: "image/svg+xml" });
      thumbUrl = imageUrl;
    }

    // Save to IndexedDB
    const record = await createRecord({
      imageBlob: blob,
      thumbnailDataUrl: thumbUrl,
      detections: dets,
      inferenceMs: elapsed,
      modelVersion: "yolo26m-pipevision-fp16",
    });

    setDetections(dets);
    setInferenceMs(elapsed);
    setSavedRecord(record);
    setPageState("results");
  }

  function handleReset() {
    clearObjectUrl();
    setPageState("upload");
    setSelectedFile(null);
    setSelectedSample(null);
    setImageUrl(null);
    setDetections([]);
    setSavedRecord(null);
  }

  const canRun = imageUrl !== null && pageState === "upload";

  return (
    <main id="main-content" className="overflow-y-auto p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-fg-primary">Defect Detection</h1>
        <p className="mt-0.5 text-[13px] text-fg-tertiary">
          Upload a CCTV inspection image to run defect analysis
        </p>
      </div>

      {/* ── UPLOAD STATE ── */}
      {pageState === "upload" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
          {/* Left column: dropzone + model selector + action bar */}
          <div>
            <ImageDropzone onFileAccepted={handleFileAccepted} />

            {/* Preview strip (when file is selected) */}
            {imageUrl && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-border-default bg-bg-elevated px-4 py-3">
                <img
                  src={imageUrl}
                  alt="Selected image preview"
                  className="size-10 rounded object-cover"
                />
                <span className="flex-1 truncate text-[12px] text-fg-secondary">
                  {selectedFile?.name ?? selectedSample?.label ?? "Sample image"} selected
                </span>
              </div>
            )}

            {/* Model selector row */}
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-border-default bg-bg-surface px-4 py-3.5">
              <Cpu className="size-4 shrink-0 text-accent" aria-hidden={true} />
              <span className="text-[12px] font-medium text-fg-secondary">Detection Model</span>
              <div className="flex-1 rounded border border-border-hover bg-bg-base px-3 py-1.5 font-mono text-[12px] text-fg-primary">
                YOLO26m — Sewer Defect Detection (Demo)
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-fg-secondary">
                <CheckSquare className="size-3.5 text-accent" aria-hidden={true} />
                Demo mode
              </label>
            </div>

            {/* Run bar */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                size="lg"
                disabled={!canRun}
                onClick={handleRunDetection}
                className="gap-2 px-7"
                aria-label="Run mock defect detection"
              >
                <Play className="size-4" aria-hidden={true} />
                Run Detection
              </Button>
              <Button
                variant="ghost"
                size="lg"
                disabled
                aria-label="Advanced settings (not available in demo)"
              >
                Advanced Settings
              </Button>
            </div>

            {/* Sample images row */}
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-fg-tertiary">
                Try a sample image
              </div>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_CATALOG.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleSampleSelect(sample)}
                    aria-label={`Load sample: ${sample.label}`}
                    aria-pressed={selectedSample?.id === sample.id}
                    className={[
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors",
                      selectedSample?.id === sample.id
                        ? "border-accent bg-accent-muted text-accent"
                        : "border-border-default bg-bg-surface text-fg-secondary hover:border-accent hover:text-accent",
                    ].join(" ")}
                  >
                    <img
                      src={sample.dataUrl}
                      alt=""
                      className="size-6 rounded object-cover"
                      aria-hidden="true"
                    />
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right sidebar: guidelines + supported defects */}
          <div className="flex flex-col gap-4">
            <section
              className="rounded-lg border border-border-default bg-bg-surface p-5"
              aria-label="Image guidelines"
            >
              <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.6px] text-fg-secondary">
                Image Guidelines
              </div>
              <div className="flex flex-col gap-3">
                {GUIDELINES.map((g) => (
                  <div key={g.text} className="flex items-start gap-2.5">
                    <div
                      className={[
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                        g.ok
                          ? "border-success bg-success/10 text-success"
                          : "border-error bg-error/10 text-error",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      {g.ok ? "✓" : "✗"}
                    </div>
                    <p className="text-[12px] text-fg-secondary">{g.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section
              className="rounded-lg border border-border-default bg-bg-surface p-5"
              aria-label="Supported defect types"
            >
              <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.6px] text-fg-secondary">
                Supported Defects
              </div>
              <div className="flex flex-col gap-2">
                {PIPEVISION_CLASSES.map((cls) => (
                  <div key={cls.id} className="flex items-center gap-2">
                    <span
                      className="inline-block size-2.5 shrink-0 rounded-full"
                      style={{ background: cls.color }}
                      aria-hidden="true"
                    />
                    <span className="text-[12px] text-fg-secondary">{cls.name}</span>
                    <span
                      className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize"
                      style={{
                        background: `color-mix(in srgb, ${cls.color} 15%, transparent)`,
                        color: cls.color,
                      }}
                    >
                      {cls.severity}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ── PROCESSING STATE ── */}
      {pageState === "processing" && (
        <div className="flex flex-col items-center justify-center gap-5 py-24">
          <div
            className="size-10 animate-spin rounded-full border-4 border-border-default border-t-accent"
            aria-label="Running inference"
            role="status"
          />
          <div className="text-center">
            <div className="text-[14px] font-medium text-fg-primary">Running inference…</div>
            <div className="mt-1 font-mono text-[11px] text-fg-tertiary">
              YOLO26m · Demo mode · ~1.5s
            </div>
          </div>
        </div>
      )}

      {/* ── RESULTS STATE ── */}
      {pageState === "results" && imageUrl && (
        <div>
          {/* Toolbar */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] text-fg-secondary">
              <span className="font-mono">
                {selectedFile?.name ?? selectedSample?.label ?? "image"}
              </span>
              {savedRecord && <span className="text-fg-tertiary">· saved to history</span>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-1.5"
              aria-label="Upload a new image"
            >
              <ArrowLeft className="size-3.5" aria-hidden={true} />
              Upload New
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
            {/* Canvas with bboxes */}
            <div className="overflow-hidden rounded-lg border border-border-default bg-bg-surface">
              <div className="flex items-center gap-2 border-b border-border-default bg-bg-elevated px-3.5 py-2.5">
                <span className="font-mono text-[12px] text-fg-tertiary">Model: YOLO26m-demo</span>
                <span className="ml-auto text-[11px] text-success">Processed</span>
              </div>
              <div className="aspect-[4/3] w-full bg-bg-base">
                <DetectionCanvas
                  imageUrl={imageUrl}
                  detections={detections}
                  imgWidth={IMG_W}
                  imgHeight={IMG_H}
                />
              </div>
            </div>

            {/* Results panel */}
            <DetectionResultPanel detections={detections} inferenceMs={inferenceMs} />
          </div>
        </div>
      )}
    </main>
  );
}
