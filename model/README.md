---
license: mit
library_name: ultralytics
tags:
  - instance-segmentation
  - yolo
  - pipe-defect
  - pipe-inspection
  - onnx
pipeline_tag: image-segmentation
---

# PipeVision YOLO26m-seg — Pipeline Defect Segmentation (ONNX FP16)

**Model**: `yolo26m-seg-pipevision-fp16`
**Format**: ONNX FP16 (opset 17)
**Input**: `images` `[1, 3, 640, 640]` — NCHW, float16, RGB normalized [0, 1], letterboxed (pad 114)
**Outputs**:
- `output0` `[1, 100, 38]` float32 — end-to-end (NMS-included): `x1, y1, x2, y2, conf, classId` + 32 mask coefficients per detection
- `output1` `[1, 32, 160, 160]` float16 — mask prototypes

**Team**: Plumbers of UTS (Bo Zhao, Jadyn Braganza, Eunkwang Shin)

---

## Model Description

This model performs instance segmentation of structural defects in pipeline
CCTV inspection images. It is exported from a YOLO26m-seg PyTorch checkpoint
(`best.pt`) trained on a 6-class pipeline-defect segmentation dataset.

The model is exported **end-to-end with NMS included** in the ONNX graph
(`output0` already carries post-NMS detections capped at 100). Client code
decodes the fixed `[1, 100, 38]` tensor directly — no separate NMS pass is
required, though PipeVision still runs a light client-side IoU dedup as a guard.

Each detection's instance mask is reconstructed from the 32 mask coefficients
and the shared `output1` prototypes: `sigmoid(coeffs · prototypes)`, thresholded
at 0.5, cropped to the box and resized to image space.

---

## Intended Use

- Browser-based pipeline defect visualization (client-side ONNX Runtime Web)
- Academic research and portfolio demonstration
- Offline inspection tool prototype

**Not suitable for**: Safety-critical production deployment, real-time video
streams, mobile-only inference (model is ~45 MB).

---

## Training Data

**Dataset**: Pipeline-defect instance-segmentation set (custom, YOLO polygon format)

| Split      | Images  | Notes |
|------------|---------|-------|
| Train      | 15,484  | 70%   |
| Validation | 3,319   | 15%   |
| Test       | 3,319   | 15%   |
| **Total**  | **22,122** | —  |

**Classes** (6 total):

| ID | Class Name    | Severity |
|----|---------------|----------|
| 0  | Deformation   | high     |
| 1  | Obstacle      | high     |
| 2  | Rupture       | critical |
| 3  | Disconnect    | critical |
| 4  | Misalignment  | medium   |
| 5  | Deposition    | low      |

The class set follows a long-tail distribution — `Deposition` and `Disconnect`
are the rarest categories in the test split.

---

## Training Configuration

| Parameter         | Value                 |
|-------------------|-----------------------|
| Architecture      | YOLO26m-seg           |
| Parameters        | 21.8M                 |
| Input resolution  | 640 × 640             |
| Task              | Instance segmentation |
| Export            | ONNX FP16, opset 17, `nms=True` |
| Framework         | Ultralytics (PyTorch) |

---

## Metrics

Per-class and overall mAP (box / mask) are **pending** — the metrics export
(`results.csv`) for this training run has not been published yet. The
Model Info page in the app shows a "metrics pending" placeholder until the
numbers are available.

| Metric              | Box | Mask |
|---------------------|-----|------|
| mAP@0.5 (test)      | pending | pending |
| mAP@0.5:0.95 (test) | pending | pending |

---

## Inference Defaults

```yaml
conf_threshold: 0.25
iou_threshold: 0.45
max_detections: 100
```

### ONNX Runtime Web Example (TypeScript)

```typescript
import * as ort from 'onnxruntime-web';

const session = await ort.InferenceSession.create(MODEL_URL, {
  executionProviders: ['webgpu', 'wasm'],
});

// Input: preprocessed Float16Array [1, 3, 640, 640] (letterboxed, RGB/255)
const feeds = { images: new ort.Tensor('float16', data, [1, 3, 640, 640]) };
const results = await session.run(feeds);

// output0 [1, 100, 38]: rows of [x1,y1,x2,y2,conf,classId, ...32 mask coeffs]
//   — already NMS'd; drop rows with conf < threshold.
// output1 [1, 32, 160, 160]: mask prototypes for mask reconstruction.
const detections = results['output0'];
const prototypes = results['output1'];
```

---

## Limitations

1. **Long-tail dataset** — rare classes (`Deposition`, `Disconnect`) have fewer
   training instances and may show lower recall.
2. **Single domain** — trained on one dataset source; performance on other
   pipe inspection cameras may differ.
3. **FP16 precision** — minor numerical differences vs the FP32 baseline.
4. **No temporal context** — designed for single-image inference, not video.
5. **Metrics pending** — quantitative quality is not yet published for this run.

---

## License

MIT — Free to use for research and non-commercial projects.
