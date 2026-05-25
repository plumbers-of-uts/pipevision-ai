# PipeVision AI

Sewer pipe defect detection web app, built around a YOLO26m-seg model trained on the Roboflow Sewage Defect Detection dataset.

**Project #37 · Plumbers of UTS · 42028 Deep Learning and CNN**

[![Live demo](https://img.shields.io/badge/live-demo-f0850f)](https://plumbers-of-uts.github.io/pipevision-ai/)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

Live at https://plumbers-of-uts.github.io/pipevision-ai/

---

## Screenshots

| Dashboard | Detect |
|---|---|
| ![Dashboard](docs/screenshots/pipevision-01-dashboard.png) | ![Detect](docs/screenshots/pipevision-02-detect.png) |

| History | Model Info |
|---|---|
| ![History](docs/screenshots/pipevision-03-history.png) | ![Models](docs/screenshots/pipevision-04-models.png) |

---

## Status

Browser inference is fully wired. The Detect page runs real `onnxruntime-web` against an HF Hub–hosted FP16 ONNX model with NMS-included export, a 5-phase loading state machine (idle → fetching → compiling → warming → ready), Serwist service-worker caching, SHA-256 integrity verification, fp16 input/output conversion, and a manual Hugging Face Spaces fallback button for failure recovery.

To run the demo end-to-end, two pieces of build-time configuration are required:

1. `VITE_MODEL_URL` — public URL of the ONNX model on Hugging Face Hub
2. `VITE_MODEL_SHA256` — SHA-256 hex of the ONNX file (integrity verification + cache invalidation)

Without these, the app builds and renders the UI but the Detect page shows a clear `Model URL is not configured` error rather than failing silently. See [Configuration](#configuration).

## Test Set Performance

Numbers below come from `model/metadata.yaml` (the post-training export the demo serves).

| Metric | Box | Mask |
|---|---|---|
| mAP@0.5 | 0.534 | 0.475 |
| mAP@0.5:0.95 | 0.302 | 0.271 |

Best checkpoint at epoch 114 / 200; FP16 ONNX is ~45 MB. Per-class mAP@0.5 (box) ranges from 0.901 (Utility intrusion) down to 0.080 (Buckling) — see the Model Info page for the full per-class table and chart.

### Defect Classes

Buckling · Crack · Debris · Hole · Joint offset · Obstacle · Utility intrusion

---

## Tech Stack

| Layer | Choice |
|---|---|
| UI | Vite 6 + React 19 + TypeScript |
| Runtime / package manager | bun 1.1+ |
| Styling | Tailwind v4 + shadcn/ui |
| Local storage | Dexie (IndexedDB), seeded on first launch |
| Charts | recharts |
| Inference | onnxruntime-web 1.26 (WebGPU EP → WASM SIMD fallback, single-threaded) |
| Model hosting | Hugging Face Hub (FP16 ONNX, NMS-included seg export) |
| Service worker | Serwist (`src/sw.ts`) — precache app shell + cache-first for ONNX + ORT WASM |
| Fallback | Hugging Face Spaces (Gradio) — manual button, structured JSON detections |
| Tests | Vitest (`src/features/**/__tests__/`) |
| Code hosting | GitHub Pages, deployed via GitHub Actions |
| Lint, format, hooks | biome + lefthook + commitlint |
| Task runner | mise |

---

## Quick Start

Requires [mise](https://mise.jdx.dev/). bun is installed on first `mise install`.

```bash
git clone git@github.com:plumbers-of-uts/pipevision-ai.git
cd pipevision-ai
mise trust
bun install
cp .env.example .env.local
# Edit .env.local with your VITE_MODEL_URL and VITE_MODEL_SHA256 — see Configuration below.
mise run dev
```

The dev server is at http://localhost:5173/pipevision-ai/. On first load, IndexedDB is populated with demo records so the Dashboard, History, and Models pages have content immediately.

Other tasks:

```bash
mise run build       # type-check + production build
mise run lint        # biome check
mise run format      # biome format --write
mise run typecheck   # tsc --noEmit
bun run test         # vitest unit tests for postprocess + NMS + history defect-class filter
```

## Configuration

The Detect page expects two environment variables at build time. The build will succeed without them, but the page will display a configuration error until they are set.

| Variable | Required | Description |
|---|---|---|
| `VITE_MODEL_URL` | yes | Public URL of the ONNX FP16 model on Hugging Face Hub. e.g. `https://huggingface.co/<user>/pipevision-yolo26m-seg/resolve/main/yolo26m-seg-fp16.onnx` |
| `VITE_MODEL_SHA256` | yes (production) | SHA-256 hex of the ONNX file. Doubles as the Service Worker cache-busting key (`?v=<first 8 hex>`). Leave blank in dev to skip integrity verification. |
| `VITE_SPACES_URL` | optional | Hugging Face Spaces URL for the Gradio fallback. When blank, the "Try Hugging Face Spaces fallback" button is hidden. |

For local development, copy `.env.example` to `.env.local` and fill in the values. For CI deployment via GitHub Actions, configure the variables as repository **Secrets** (`VITE_MODEL_URL`, `VITE_MODEL_SHA256`) and **Variables** (`VITE_SPACES_URL`) under *Settings → Secrets and variables → Actions*. The workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) already wires these into the build step.

### Detect page demo flow

1. Open `/detect`.
2. Click a sample image, or drop your own (JPEG / PNG / WebP).
3. Click **Run Detection**. The model loads on first use (status pill in the sidebar shows progress); subsequent visits hit the Service Worker cache.
4. Bounding boxes and instance masks are drawn directly on the original image, with per-defect class, severity, and confidence in the result panel.
5. Each run is saved to IndexedDB and visible from the Dashboard and History pages.

If the model fetch or inference fails and `VITE_SPACES_URL` is set, the error card offers a one-click Spaces fallback that hits the Gradio API instead — same `Detection[]` shape, different `modelVersion`.

---

## Project Structure

```
pipevision-ai/
├── docs/
│   ├── plans/                      # design and execution plans
│   └── screenshots/
├── model/                          # ONNX export pipeline (Python, uv-managed)
│   ├── download.sh                 # SageMaker S3 → local
│   ├── export.py                   # PyTorch → ONNX FP16
│   ├── verify.py                   # PT vs ONNX mAP regression check
│   ├── upload.sh                   # → Hugging Face Hub
│   ├── metadata.yaml
│   ├── pyproject.toml
│   └── usage.md                    # step-by-step runbook
├── src/
│   ├── app/                        # router + providers (ModelProvider, Theme, Seed)
│   ├── pages/                      # dashboard, detect, history, models
│   ├── widgets/                    # page-level composition components
│   ├── features/
│   │   ├── inference/              # ORT session, pre/postprocess, NMS, mask decode
│   │   ├── history-store/          # Dexie schema, repository, seed
│   │   ├── samples/                # bundled CCTV sample images
│   │   └── export/                 # PNG/CSV/JSON export of history
│   ├── components/ui/              # shadcn primitives
│   ├── lib/onnx/                   # ORT loader, fp16 codec, SW register
│   └── styles/globals.css
├── .github/workflows/deploy.yml
├── DESIGN.md                       # design tokens
├── gui-mockup.html                 # original static mockup
├── mise.toml
└── README.md
```

---

## Publishing the trained model

The scripts in `model/` take the trained `best.pt` from SageMaker, export it to ONNX FP16, check that mAP has not regressed, and push the result to a Hugging Face Hub model repo. Run this once after training; re-run after any retraining.

Required environment variables:

| Variable | Description |
|---|---|
| `SAGEMAKER_MODEL_S3_URI` | Full S3 URI of the SageMaker `model.tar.gz` |
| `AWS_PROFILE` | AWS CLI profile (defaults to `default`) |
| `HF_USER` | Hugging Face username |
| `HF_TOKEN` | HF token with write access (or run `huggingface-cli login`) |
| `VAL_DATASET_YAML` | Absolute path to the Roboflow Ultralytics dataset config produced by Roboflow's "Export → YOLO" flow |

Then:

```bash
uv sync --project model
mise run model:download   # S3 → model/artifacts/best.pt
mise run model:export     # → model/artifacts/yolo26m-seg-fp16.onnx
mise run model:verify     # PASS if |Δ mAP@0.5| < 0.005
mise run model:upload     # → huggingface.co/<HF_USER>/pipevision-yolo26m-seg
```

After upload, point the frontend at the model URL via `VITE_MODEL_URL`; runtime parsing lives in [`src/features/inference/model-config.ts`](src/features/inference/model-config.ts). Full instructions in [`model/usage.md`](model/usage.md).

---

## What's left

Code-wise the demo is complete. To actually run it you need:

- [ ] Hugging Face Hub account + write token; run the four `model:*` tasks above to publish the ONNX model.
- [ ] Set `VITE_MODEL_URL` and `VITE_MODEL_SHA256` (see [Configuration](#configuration)).
- [ ] (Optional) Deploy a Gradio Spaces fallback and set `VITE_SPACES_URL`.

Tracked in [`docs/plans/work/001-browser-inference-finalization.md`](docs/plans/work/001-browser-inference-finalization.md) and [`docs/plans/work/tech-debt-tracker.md`](docs/plans/work/tech-debt-tracker.md):

- Playwright E2E coverage of the Detect flow.
- Background model prefetch on the Dashboard route, Web Worker inference (currently main-thread only), INT8 quantization for mobile, i18n (Korean/English), opt-in anonymous telemetry, video and live-camera support.
- Bundle: the 26 MB `ort-wasm-simd-threaded.jsep.wasm` shipped by ORT 1.26 cannot currently be excluded without breaking the runtime (`numThreads=1` still requires the threaded build).

---

## References

1. Hidayatullah, P., & Tubagus, R. (2026). YOLO26: A comprehensive architecture overview and key improvements. *arXiv preprint* [arXiv:2602.14582](https://arxiv.org/abs/2602.14582).
2. Lin, T.-Y., Goyal, P., Girshick, R., He, K., & Dollar, P. (2018). Focal loss for dense object detection. *IEEE TPAMI*. [doi:10.1109/tpami.2018.2858826](https://doi.org/10.1109/tpami.2018.2858826).
3. Ren, S., He, K., Girshick, R., & Sun, J. (2017). Faster R-CNN: Towards real-time object detection with region proposal networks. *IEEE TPAMI*, 39(6), 1137–1149. [doi:10.1109/tpami.2016.2577031](https://doi.org/10.1109/tpami.2016.2577031).

---

## License

MIT
