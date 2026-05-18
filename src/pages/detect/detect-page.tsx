/**
 * detect-page.tsx — Defect Detection page.
 *
 * Workflow:
 *   1. ModelProvider begins loading when user lands on Detect.
 *      Sample selection is available immediately even during model download (F1).
 *   2. "Run Detection" calls real ONNX inference via useInference().
 *   3. Results panel shows detections + pipe condition grade + accuracy disclaimer (F2).
 *   4. "Upload New" resets to dropzone state.
 *   5. If model loading or inference fails, an error card with optional Spaces
 *      fallback button is shown (T15 — button hidden when VITE_SPACES_URL absent).
 *
 * runMockInference has been removed. Real inference via InferenceService (Sprint 3).
 * Matches gui-mockup.html #page-detect (lines 926-1176).
 */

import { useBoolean } from "ahooks";
import { AlertTriangle, ArrowLeft, CheckSquare, Cpu, Info, Play, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getActiveSession, useModelContext, useModelStatus } from "@/app/providers/model-provider";
import { Button } from "@/components/ui/button";
import { PIPEVISION_CLASSES } from "@/features/history-store/classes";
import { createRecord } from "@/features/history-store/repository";
import type { Detection, HistoryRecord } from "@/features/history-store/types";
import { isSpacesFallbackAvailable, runSpacesFallback } from "@/features/inference/fallback-spaces";
import { sourceToBitmap } from "@/features/inference/preprocess";
import type { ErrorCode } from "@/features/inference/types";
import { useInference } from "@/features/inference/use-inference";
import type { SampleImage } from "@/features/samples/catalog";
import { DetectionCanvas } from "@/widgets/detection-canvas";
import { DetectionResultPanel } from "@/widgets/detection-result-panel";
import { ImageDropzone } from "@/widgets/image-dropzone";
import { ModelLoadingProgress } from "@/widgets/model-loading-progress";
import { SampleGallery } from "@/widgets/sample-gallery";

// ─── Upload guidelines ────────────────────────────────────────────────────────

const GUIDELINES = [
  { ok: true, text: "Minimum resolution 640×480px for accurate detection" },
  { ok: true, text: "Ensure adequate lighting; overexposed areas reduce accuracy" },
  { ok: true, text: "Frontal or axial pipe view preferred over angled shots" },
  { ok: false, text: "Avoid heavily motion-blurred or compressed images" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a File or Blob to a base64 data URL. */
async function toDataUrl(source: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(source);
  });
}

/** Fetch a same-origin sample image and return its Blob. */
async function fetchSampleBlob(src: string): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to load sample ${src}: ${res.status}`);
  return res.blob();
}

// ─── Error display messages ───────────────────────────────────────────────────

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NETWORK: "Couldn't reach the model server.",
  INTEGRITY: "Model file appears corrupted; refreshing cache…",
  UNSUPPORTED: "This browser doesn't support local inference.",
  SESSION_CREATE: "Couldn't initialize the model. Trying fallback runtime…",
  RUNTIME: "Inference failed on this image.",
};

// ─── Component ────────────────────────────────────────────────────────────────

type PageState = "upload" | "loading-model" | "processing" | "results" | "error";

export function DetectPage() {
  const [pageState, setPageState] = useState<PageState>("upload");
  const stateRegionRef = useRef<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: pageState is the trigger; stateRegionRef is intentionally stable
  useEffect(() => {
    // Move focus into the active state region so keyboard / screen-reader users see the change
    stateRegionRef.current?.focus();
  }, [pageState]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSample, setSelectedSample] = useState<SampleImage | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // Actual image dimensions from the decoded ImageBitmap (replaces hardcoded 640/480)
  const [imgWidth, setImgWidth] = useState(0);
  const [imgHeight, setImgHeight] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [inferenceMs, setInferenceMs] = useState(0);
  const [savedRecord, setSavedRecord] = useState<HistoryRecord | null>(null);
  const [spacesRunning, { setTrue: startSpaces, setFalse: stopSpaces }] = useBoolean(false);
  const [spacesError, setSpacesError] = useState<string | null>(null);

  const objectUrlRef = useRef<string | null>(null);

  const modelStatus = useModelStatus();
  const { ensureReady, retry } = useModelContext();
  const inference = useInference();

  // Trigger model load on Detect page mount (only Detect triggers ensureReady — D-G).
  // Swallow rejection: error state is surfaced via modelStatus.phase === "error",
  // and ensureReady rejects in that state to prevent an auto-retry loop. Explicit
  // retry comes from the Retry button.
  useEffect(() => {
    ensureReady().catch(() => {});
  }, [ensureReady]);

  // Revoke any outstanding object URL on unmount to avoid blob leaks.
  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    },
    [],
  );

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
    setImageUrl(sample.src);
  }

  async function handleRunDetection() {
    if (!imageUrl) return;
    if (!selectedFile && !selectedSample) return;

    const isLoading =
      modelStatus.phase === "fetching" ||
      modelStatus.phase === "compiling" ||
      modelStatus.phase === "warming";

    if (isLoading) {
      setPageState("loading-model");
      await ensureReady();
    }

    // Check the live session ref instead of the stale modelStatus closure
    // captured at render time — ensureReady() may have transitioned to error.
    if (getActiveSession() === null) {
      setPageState("error");
      return;
    }

    setPageState("processing");
    setSpacesError(null);

    try {
      let sourceBlob: File | Blob;
      let thumbUrl: string;
      let imageDataUrl: string;

      if (selectedFile) {
        sourceBlob = selectedFile;
        thumbUrl = imageUrl;
        imageDataUrl = await toDataUrl(selectedFile);
      } else if (selectedSample) {
        sourceBlob = await fetchSampleBlob(selectedSample.src);
        imageDataUrl = await toDataUrl(sourceBlob);
        thumbUrl = imageDataUrl;
      } else {
        // Unreachable: guarded by the early return above.
        return;
      }

      // Decode to get actual image dimensions (used by DetectionCanvas for scaling)
      const bitmap = await sourceToBitmap(sourceBlob);
      setImgWidth(bitmap.width);
      setImgHeight(bitmap.height);
      bitmap.close();

      const startMs = Date.now();

      const { detections: dets } = await inference.runWithFallback(
        { source: sourceBlob },
        imageDataUrl,
      );

      const elapsed = Date.now() - startMs;

      const record = await createRecord({
        imageBlob: sourceBlob,
        thumbnailDataUrl: thumbUrl,
        detections: dets,
        inferenceMs: elapsed,
        modelVersion:
          modelStatus.phase === "ready"
            ? `yolo26m-pipevision-fp16-${modelStatus.backend}`
            : "yolo26m-pipevision-fp16",
      });

      setDetections(dets);
      setInferenceMs(elapsed);
      setSavedRecord(record);
      setPageState("results");
    } catch (err) {
      console.error("[DetectPage] Inference failed:", err);
      setPageState("error");
    }
  }

  async function handleSpacesFallback() {
    if (!imageUrl) return;
    if (!selectedFile && !selectedSample) return;
    startSpaces();
    setSpacesError(null);

    try {
      let imageDataUrl: string;
      let thumbUrl: string;
      let sourceBlob: File | Blob;

      if (selectedFile) {
        imageDataUrl = await toDataUrl(selectedFile);
        thumbUrl = imageUrl;
        sourceBlob = selectedFile;
      } else if (selectedSample) {
        sourceBlob = await fetchSampleBlob(selectedSample.src);
        imageDataUrl = await toDataUrl(sourceBlob);
        thumbUrl = imageDataUrl;
      } else {
        // Unreachable: guarded by the early return above.
        return;
      }

      const dets = await runSpacesFallback(imageDataUrl);

      const bitmap = await sourceToBitmap(sourceBlob);
      setImgWidth(bitmap.width);
      setImgHeight(bitmap.height);
      bitmap.close();

      const record = await createRecord({
        imageBlob: sourceBlob,
        thumbnailDataUrl: thumbUrl,
        detections: dets,
        inferenceMs: 0,
        modelVersion: "yolo26m-pipevision-fp16-spaces",
      });

      setDetections(dets);
      setInferenceMs(0);
      setSavedRecord(record);
      setPageState("results");
    } catch (err) {
      setSpacesError(err instanceof Error ? err.message : "Spaces fallback failed.");
    } finally {
      stopSpaces();
    }
  }

  function handleReset() {
    clearObjectUrl();
    setPageState("upload");
    setSelectedFile(null);
    setSelectedSample(null);
    setImageUrl(null);
    setDetections([]);
    setSavedRecord(null);
    setSpacesError(null);
    setImgWidth(0);
    setImgHeight(0);
  }

  const isModelLoading =
    modelStatus.phase === "fetching" ||
    modelStatus.phase === "compiling" ||
    modelStatus.phase === "warming";

  const canRun =
    imageUrl !== null &&
    pageState === "upload" &&
    !inference.isRunning &&
    modelStatus.phase !== "error";

  const showSpacesFallback = isSpacesFallbackAvailable();

  // Prefer the raw provider reason when it carries the actionable config message,
  // otherwise fall back to the friendly per-code mapping.
  const modelErrorReason =
    modelStatus.phase === "error"
      ? modelStatus.reason.includes("not configured")
        ? modelStatus.reason
        : (ERROR_MESSAGES[modelStatus.code] ?? modelStatus.reason)
      : null;

  return (
    <main
      id="main-content"
      ref={stateRegionRef}
      tabIndex={-1}
      className="overflow-y-auto p-6 focus:outline-none"
    >
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-fg-primary">Defect Detection</h1>
        <p className="mt-0.5 text-[13px] text-fg-tertiary">
          Upload a CCTV inspection image to run defect analysis
        </p>
      </div>

      {/* ── MODEL LOADING PROGRESS (visible above upload form while model is fetching/compiling/warming) ── */}
      {isModelLoading && pageState === "upload" && (
        <ModelLoadingProgress status={modelStatus} className="mb-4" />
      )}

      {/* ── MODEL ERROR BANNER (visible above upload form when model is in error state) ── */}
      {modelStatus.phase === "error" && pageState === "upload" && (
        <div
          className="mb-4 flex flex-col gap-2 rounded-lg border border-error/40 bg-error/5 px-4 py-3"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start gap-2.5">
            <div
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-error/15 text-error text-[11px] font-bold"
              aria-hidden="true"
            >
              !
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-fg-primary">Model unavailable</div>
              <div className="mt-0.5 text-[12px] text-fg-secondary">{modelErrorReason}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 pl-7">
            {modelStatus.retryable && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void retry()}
                aria-label="Retry loading the model"
              >
                Retry
              </Button>
            )}
            {showSpacesFallback && imageUrl && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleSpacesFallback()}
                disabled={spacesRunning}
                aria-label="Run inference on Hugging Face Spaces fallback"
              >
                {spacesRunning ? "Trying Spaces…" : "Try Spaces fallback"}
              </Button>
            )}
            {showSpacesFallback && !imageUrl && (
              <span className="text-[11px] text-fg-tertiary">
                Pick an image to try the Spaces fallback.
              </span>
            )}
          </div>
          {spacesError && (
            <div
              className="mt-1 rounded border border-error/30 bg-error/10 px-2.5 py-1.5 text-[12px] text-error"
              role="alert"
            >
              {spacesError}
            </div>
          )}
        </div>
      )}

      {/* ── UPLOAD / LOADING-MODEL STATE ── */}
      {(pageState === "upload" || pageState === "loading-model") && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
          {/* Left column */}
          <div>
            <ImageDropzone onFileAccepted={handleFileAccepted} />

            {/* Sample gallery — real CCTV frames, available even while model loads (F1) */}
            <SampleGallery
              className="mt-4"
              selectedId={selectedSample?.id ?? null}
              onSelect={handleSampleSelect}
            />

            {/* Preview strip */}
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
                YOLO26m — Sewer Defect Detection
              </div>
              {modelStatus.phase === "ready" && (
                <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-success">
                  <CheckSquare className="size-3.5 text-success" aria-hidden={true} />
                  {modelStatus.backend === "webgpu" ? "WebGPU" : "WASM"}
                </label>
              )}
              {isModelLoading && (
                <span className="shrink-0 text-[12px] text-fg-tertiary">Loading…</span>
              )}
            </div>

            {/* Run bar */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                size="lg"
                disabled={!canRun}
                onClick={handleRunDetection}
                className="gap-2 px-7"
                aria-label="Run defect detection"
              >
                <Play className="size-4" aria-hidden={true} />
                {modelStatus.phase === "error"
                  ? "Model unavailable"
                  : isModelLoading
                    ? "Waiting for model…"
                    : "Run Detection"}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                disabled
                aria-label="Advanced settings (not available)"
              >
                Advanced Settings
              </Button>
            </div>
          </div>

          {/* Right sidebar */}
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
              YOLO26m · {modelStatus.phase === "ready" ? modelStatus.backend.toUpperCase() : "WASM"}
            </div>
          </div>
        </div>
      )}

      {/* ── ERROR STATE ── */}
      {pageState === "error" && (
        <div className="flex flex-col items-center justify-center gap-5 py-24">
          <div
            className="w-full max-w-md rounded-lg border border-error/30 bg-error/5 p-6"
            role="alert"
          >
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="size-5 shrink-0 text-error" aria-hidden="true" />
              <span className="text-[14px] font-semibold text-fg-primary">Inference failed</span>
            </div>
            <p className="mb-4 text-[13px] text-fg-secondary">
              {modelErrorReason ??
                inference.lastError?.message ??
                "An unexpected error occurred. Please try again."}
            </p>

            <div className="flex flex-wrap gap-2">
              {(modelStatus.phase !== "error" || modelStatus.retryable) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (modelStatus.phase === "error") {
                      void retry({ bustCache: modelStatus.code === "INTEGRITY" });
                    }
                    setPageState("upload");
                  }}
                  className="gap-1.5"
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  Retry
                </Button>
              )}

              {/* Spaces fallback — hidden when VITE_SPACES_URL absent (T15, D-H) */}
              {isSpacesFallbackAvailable() && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSpacesFallback}
                  disabled={spacesRunning || !imageUrl}
                  className="gap-1.5"
                >
                  {spacesRunning ? (
                    <>
                      <div
                        className="size-3.5 animate-spin rounded-full border-2 border-border-default border-t-accent"
                        aria-hidden="true"
                      />
                      Waking up server…
                    </>
                  ) : (
                    "Try Hugging Face Spaces"
                  )}
                </Button>
              )}

              <Button size="sm" variant="ghost" onClick={handleReset} className="gap-1.5">
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Upload New
              </Button>
            </div>

            {spacesError && (
              <p className="mt-3 text-[12px] text-error" role="alert">
                {spacesError}
              </p>
            )}
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
                <span className="font-mono text-[12px] text-fg-tertiary">
                  Model: YOLO26m
                  {modelStatus.phase === "ready" ? ` (${modelStatus.backend})` : ""}
                </span>
                <span className="ml-auto text-[11px] text-success">Processed</span>
              </div>
              <div className="aspect-[4/3] w-full bg-bg-base">
                {/* imgWidth/imgHeight come from the decoded ImageBitmap (not hardcoded) */}
                <DetectionCanvas
                  imageUrl={imageUrl}
                  detections={detections}
                  imgWidth={imgWidth > 0 ? imgWidth : 640}
                  imgHeight={imgHeight > 0 ? imgHeight : 480}
                />
              </div>
            </div>

            {/* Results panel + accuracy disclaimer (F2) */}
            <div className="flex flex-col gap-3">
              <DetectionResultPanel detections={detections} inferenceMs={inferenceMs} />

              {/* F2 — accuracy calibration notice per D-I decision */}
              <div className="flex items-start gap-2 rounded-lg border border-border-default bg-bg-surface px-3.5 py-3">
                <Info className="mt-0.5 size-3.5 shrink-0 text-fg-tertiary" aria-hidden="true" />
                <p className="text-[11px] leading-relaxed text-fg-tertiary">
                  Demo accuracy: mAP@0.5 = 0.44 — may miss subtle defects.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
