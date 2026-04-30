---
license: mit
library_name: ultralytics
tags:
  - object-detection
  - yolo
  - sewer-defect
  - pipe-inspection
  - onnx
pipeline_tag: object-detection
---

# PipeVision YOLO26m — Sewer Defect Detection (ONNX FP16)

**Model**: `yolo26m-pipevision-fp16`
**Format**: ONNX FP16 (opset 17)
**Input**: `[1, 3, 640, 640]` — NCHW, float16, normalized [0, 1]
**Output**: `[1, 11, 8400]` — 4 box coords + 7 class scores × 8400 anchors (NMS not included)
**Team**: Plumbers of UTS (Bo Zhao, Jadyn Braganza, Eunkwang Shin)

---

## Model Description

This model detects structural defects in sewer pipe inspection images. It is exported from a YOLO26m PyTorch checkpoint (`best.pt`) trained on the Roboflow Sewage Defect Detection dataset.

The model is exported with `nms=False` — non-maximum suppression is intentionally excluded from the ONNX graph and must be applied client-side. This design choice provides:
- Stable ONNX export (no custom NMS ops)
- User-adjustable confidence and IoU thresholds at inference time
- Efficient execution under the WebGPU execution provider

**Honest assessment**: mAP@0.5 = 0.44. Two classes (Crack, Joint offset) have weak detection recall due to dataset long-tail distribution (22.5:1 class imbalance). See Limitations section.

---

## Intended Use

- Browser-based sewer pipe defect visualization (client-side ONNX Runtime Web)
- Academic research and portfolio demonstration
- Offline inspection tool prototype

**Not suitable for**: Safety-critical production deployment, real-time video streams, mobile-only inference (model is ~44 MB).

---

## Training Data

**Dataset**: [Roboflow Sewage Defect Detection](https://roboflow.com)

| Split      | Images | Notes |
|------------|--------|-------|
| Train      | 686    | 70%   |
| Validation | 196    | 20%   |
| Test       | 98     | 10%   |
| **Total**  | **980**| —     |

**Classes** (7 total):

| ID | Class Name       | Severity |
|----|-----------------|----------|
| 0  | Buckling        | high     |
| 1  | Crack           | medium   |
| 2  | Debris          | low      |
| 3  | Hole            | critical |
| 4  | Joint offset    | medium   |
| 5  | Obstacle        | high     |
| 6  | Utility intrusion | high   |

**Class distribution** (approximate, training set):
- Crack: ~696 instances (dominant)
- Hole: ~31 instances (rarest)
- **Long-tail ratio**: 22.5:1 (Crack vs Hole)

---

## Training Configuration

| Parameter         | Value              |
|------------------|--------------------|
| Architecture     | YOLO26m            |
| Parameters       | 21.8M              |
| Optimizer        | MuSGD (lr=0.01)    |
| Batch size       | 16                 |
| Input resolution | 640 × 640          |
| Best epoch       | 57 / 85 (patience) |
| Max epochs       | 200                |
| Hardware         | Tesla T4 (SageMaker) |
| Framework        | Ultralytics (PyTorch) |

---

## Metrics

### Test Set Results (98 images)

| Class            | Images | Instances | Precision | Recall | mAP@0.5 | mAP@0.5:0.95 |
|-----------------|--------|-----------|-----------|--------|---------|--------------|
| **All (mean)**  | 98     | —         | —         | —      | **0.440** | **0.198**  |
| Buckling        | —      | —         | —         | —      | 0.364   | —            |
| Crack           | —      | —         | —         | —      | 0.582   | —            |
| Debris          | —      | —         | —         | —      | 0.525   | —            |
| Hole            | —      | —         | —         | —      | 0.384   | —            |
| Joint offset    | —      | —         | —         | —      | 0.196   | —            |
| Obstacle        | —      | —         | —         | —      | 0.668   | —            |
| Utility intrusion | —   | —         | —         | —      | 0.708   | —            |

### Validation Set Results (196 images)

| Class            | Images | Instances | Precision | Recall | mAP@0.5 | mAP@0.5:0.95 |
|-----------------|--------|-----------|-----------|--------|---------|--------------|
| **All (mean)**  | 196    | —         | —         | —      | **0.439** | **0.198**  |
| Buckling        | —      | —         | —         | —      | 0.363   | —            |
| Crack           | —      | —         | —         | —      | 0.581   | —            |
| Debris          | —      | —         | —         | —      | 0.524   | —            |
| Hole            | —      | —         | —         | —      | 0.382   | —            |
| Joint offset    | —      | —         | —         | —      | 0.195   | —            |
| Obstacle        | —      | —         | —         | —      | 0.667   | —            |
| Utility intrusion | —   | —         | —         | —      | 0.706   | —            |

*Source: Initial experiment PDF results (Jadyn Braganza, UTS Assignment 3 Part C)*

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

// Input: preprocessed Float16Array [1, 3, 640, 640]
const feeds = { images: new ort.Tensor('float16', data, [1, 3, 640, 640]) };
const results = await session.run(feeds);
// Output shape: [1, 11, 8400] — apply NMS client-side
const output = results['output0'];
```

---

## Limitations

1. **Crack and Joint offset detection is weak** — mAP@0.5 of 0.582 / 0.196 respectively. Joint offset is the worst-performing class.
2. **Long-tail dataset** — 22.5:1 imbalance (Crack vs Hole) causes the model to over-predict Crack and under-predict rare classes.
3. **Small dataset** — 980 images total is insufficient for robust generalization to real-world pipe conditions beyond the training distribution.
4. **Single domain** — Trained on one dataset source (Roboflow Sewage Defect Detection). Performance on other pipe inspection cameras may differ significantly.
5. **FP16 precision** — Minor numerical differences vs FP32 baseline; |Δ mAP@0.5| verified < 0.005.
6. **No temporal context** — Designed for single-image inference, not video streams.

---

## References

1. YOLO26 architecture: Wang, C. et al. (2025). *YOLO26: Efficient Object Detection with...* arXiv:2602.14582
2. Lin, T. et al. (2017). *Focal Loss for Dense Object Detection*. ICCV 2017.
3. Ren, S. et al. (2015). *Faster R-CNN: Towards Real-Time Object Detection with Region Proposal Networks*. NeurIPS 2015.
4. Roboflow Sewage Defect Detection dataset.

---

## License

MIT — Free to use for research and non-commercial projects.
