"""verify.py — Compare PT vs ONNX mAP@0.5 regression test.

Runs ultralytics .val() on the validation set for both the original PyTorch
model and the exported ONNX model, then asserts |Δ mAP@0.5| < 0.005.

Usage:
    uv run python model/verify.py

Environment variables:
    VAL_DATASET_YAML   Path to data.yaml for validation set (default: data.yaml in cwd)
    ONNX_MODEL         Path to ONNX model to verify
                       (default: model/artifacts/yolo26m-fp16-opt.onnx,
                        falls back to model/artifacts/yolo26m-fp16.onnx)
    INPUT_PT           Path to .pt checkpoint (default: model/artifacts/best.pt)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

# Regression threshold: |Δ mAP@0.5| must be below this value
MAP50_DELTA_THRESHOLD: float = 0.005

# ONNX inference hyperparameters — must match C1 contract defaults
CONF_THRESHOLD: float = 0.25
IOU_THRESHOLD: float = 0.45
MAX_DETECTIONS: int = 100
INPUT_SIZE: int = 640


def _resolve_paths() -> tuple[Path, Path, Path]:
    """Resolve model and dataset paths from environment variables."""
    script_dir = Path(__file__).parent
    artifacts_dir = script_dir / "artifacts"

    # PT checkpoint
    input_pt_env = os.environ.get("INPUT_PT", "")
    input_pt = Path(input_pt_env) if input_pt_env else artifacts_dir / "best.pt"

    # ONNX model: prefer optimized, fall back to base FP16
    onnx_env = os.environ.get("ONNX_MODEL", "")
    if onnx_env:
        onnx_model = Path(onnx_env)
    else:
        opt_path = artifacts_dir / "yolo26m-fp16-opt.onnx"
        base_path = artifacts_dir / "yolo26m-fp16.onnx"
        onnx_model = opt_path if opt_path.exists() else base_path

    # Validation dataset yaml
    val_yaml_env = os.environ.get("VAL_DATASET_YAML", "")
    val_yaml = Path(val_yaml_env) if val_yaml_env else Path("data.yaml")

    return input_pt, onnx_model, val_yaml


def _check_dependencies() -> None:
    """Verify required packages are importable."""
    missing = []
    for pkg in ("ultralytics", "onnxruntime", "numpy", "cv2"):
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"ERROR: Missing packages: {', '.join(missing)}", file=sys.stderr)
        print("  Run: uv sync", file=sys.stderr)
        sys.exit(1)


def validate_pt(input_pt: Path, val_yaml: Path) -> float:
    """Run ultralytics .val() on the PyTorch model and return mAP@0.5."""
    from ultralytics import YOLO

    print(f"[PT] Loading checkpoint: {input_pt}")
    model = YOLO(str(input_pt))

    print(f"[PT] Running validation on: {val_yaml}")
    metrics = model.val(
        data=str(val_yaml),
        imgsz=INPUT_SIZE,
        conf=CONF_THRESHOLD,
        iou=IOU_THRESHOLD,
        max_det=MAX_DETECTIONS,
        device="cpu",
        verbose=False,
    )

    map50: float = float(metrics.box.map50)
    print(f"[PT] mAP@0.5 = {map50:.4f}")
    return map50


def _letterbox(
    image: Any,
    target_size: int = 640,
    fill_value: int = 114,
) -> tuple[Any, float, tuple[int, int]]:
    """Resize image with letterboxing to target_size × target_size.

    Returns:
        padded_image: uint8 HWC numpy array of shape (target_size, target_size, 3)
        scale:        scale factor applied to original image dimensions
        pad:          (pad_w, pad_h) padding added on each side
    """
    import numpy as np

    h, w = image.shape[:2]
    scale = min(target_size / h, target_size / w)
    new_h, new_w = int(round(h * scale)), int(round(w * scale))

    import cv2

    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    pad_h = (target_size - new_h) // 2
    pad_w = (target_size - new_w) // 2

    padded = np.full((target_size, target_size, 3), fill_value, dtype=np.uint8)
    padded[pad_h : pad_h + new_h, pad_w : pad_w + new_w] = resized

    return padded, scale, (pad_w, pad_h)


def _preprocess_image(image_bgr: Any) -> Any:
    """Convert BGR uint8 HWC image to float32 NCHW tensor in [0, 1]."""
    import numpy as np

    padded, _scale, _pad = _letterbox(image_bgr, target_size=INPUT_SIZE)
    # BGR -> RGB, HWC -> CHW
    rgb = padded[:, :, ::-1].astype(np.float32) / 255.0
    nchw = rgb.transpose(2, 0, 1)[np.newaxis, ...]  # (1, 3, H, W)
    return nchw.astype(np.float32)


def _nms(boxes: Any, scores: Any, iou_threshold: float) -> list[int]:
    """Greedy non-maximum suppression. Returns kept box indices."""
    import numpy as np

    if len(boxes) == 0:
        return []

    x1 = boxes[:, 0] - boxes[:, 2] / 2
    y1 = boxes[:, 1] - boxes[:, 3] / 2
    x2 = boxes[:, 0] + boxes[:, 2] / 2
    y2 = boxes[:, 1] + boxes[:, 3] / 2
    areas = (x2 - x1).clip(0) * (y2 - y1).clip(0)

    order = scores.argsort()[::-1]
    kept: list[int] = []

    while len(order) > 0:
        i = int(order[0])
        kept.append(i)
        order = order[1:]
        if len(order) == 0:
            break

        xx1 = np.maximum(x1[i], x1[order])
        yy1 = np.maximum(y1[i], y1[order])
        xx2 = np.minimum(x2[i], x2[order])
        yy2 = np.minimum(y2[i], y2[order])
        inter = (xx2 - xx1).clip(0) * (yy2 - yy1).clip(0)
        union = areas[i] + areas[order] - inter
        iou = inter / (union + 1e-7)
        order = order[iou <= iou_threshold]

    return kept


def _postprocess(
    raw_output: Any,
    num_classes: int = 7,
    conf_threshold: float = CONF_THRESHOLD,
    iou_threshold: float = IOU_THRESHOLD,
) -> list[dict[str, Any]]:
    """Convert raw ONNX output to list of detection dicts.

    Handles both output shapes from Ultralytics export:
        [1, 4+nc, 8400] — channels-first (standard)
        [1, 8400, 4+nc] — transposed

    Each detection dict has keys: class_id, confidence, box (cx, cy, w, h).
    """
    import numpy as np

    output = raw_output[0]  # remove batch dim -> (4+nc, 8400) or (8400, 4+nc)

    if output.shape[0] == 4 + num_classes:
        # Shape: (4+nc, 8400) — transpose to (8400, 4+nc)
        output = output.T

    # output is now (8400, 4+nc)
    boxes = output[:, :4]             # cx, cy, w, h
    class_scores = output[:, 4:]      # (8400, nc)

    max_scores = class_scores.max(axis=1)
    class_ids = class_scores.argmax(axis=1)

    mask = max_scores >= conf_threshold
    boxes = boxes[mask]
    scores = max_scores[mask]
    class_ids = class_ids[mask]

    detections: list[dict[str, Any]] = []
    for cls in range(num_classes):
        cls_mask = class_ids == cls
        if not cls_mask.any():
            continue
        cls_boxes = boxes[cls_mask]
        cls_scores = scores[cls_mask]
        kept = _nms(cls_boxes, cls_scores, iou_threshold)
        for idx in kept:
            detections.append(
                {
                    "class_id": int(cls),
                    "confidence": float(cls_scores[idx]),
                    "box": cls_boxes[idx].tolist(),
                }
            )

    return detections


def _compute_map50(
    all_predictions: list[list[dict[str, Any]]],
    all_ground_truths: list[list[dict[str, Any]]],
    num_classes: int = 7,
    iou_threshold: float = 0.5,
) -> float:
    """Compute mean average precision at IoU=0.5 over a dataset.

    This is a minimal mAP@0.5 implementation matching the Ultralytics convention.
    For each class: sort predictions by confidence, compute AP via 11-point interpolation.

    Args:
        all_predictions: per-image list of {'class_id', 'confidence', 'box'} dicts
        all_ground_truths: per-image list of {'class_id', 'box'} dicts
        num_classes: number of object classes
        iou_threshold: IoU threshold for true-positive matching (0.5)

    Returns:
        mAP@0.5 as float in [0, 1]
    """
    import numpy as np

    def box_iou_xywh(a: list[float], b: list[float]) -> float:
        ax1, ay1 = a[0] - a[2] / 2, a[1] - a[3] / 2
        ax2, ay2 = a[0] + a[2] / 2, a[1] + a[3] / 2
        bx1, by1 = b[0] - b[2] / 2, b[1] - b[3] / 2
        bx2, by2 = b[0] + b[2] / 2, b[1] + b[3] / 2
        inter_w = max(0, min(ax2, bx2) - max(ax1, bx1))
        inter_h = max(0, min(ay2, by2) - max(ay1, by1))
        inter = inter_w * inter_h
        area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
        area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
        union = area_a + area_b - inter
        return inter / (union + 1e-7)

    aps: list[float] = []
    for cls in range(num_classes):
        preds: list[tuple[float, int, int]] = []  # (conf, image_idx, gt_idx or -1)
        n_gt = 0

        for img_idx, (img_preds, img_gts) in enumerate(
            zip(all_predictions, all_ground_truths)
        ):
            cls_gts = [g for g in img_gts if g["class_id"] == cls]
            n_gt += len(cls_gts)
            matched_gt: set[int] = set()

            for pred in sorted(
                [p for p in img_preds if p["class_id"] == cls],
                key=lambda x: x["confidence"],
                reverse=True,
            ):
                best_iou = 0.0
                best_gt_idx = -1
                for gt_idx, gt in enumerate(cls_gts):
                    if gt_idx in matched_gt:
                        continue
                    iou = box_iou_xywh(pred["box"], gt["box"])
                    if iou > best_iou:
                        best_iou = iou
                        best_gt_idx = gt_idx

                if best_iou >= iou_threshold and best_gt_idx >= 0:
                    matched_gt.add(best_gt_idx)
                    preds.append((pred["confidence"], img_idx, best_gt_idx))
                else:
                    preds.append((pred["confidence"], img_idx, -1))

        if n_gt == 0:
            aps.append(0.0)
            continue

        preds.sort(key=lambda x: x[0], reverse=True)
        tp = np.array([1 if p[2] >= 0 else 0 for p in preds], dtype=float)
        fp = 1 - tp
        tp_cum = np.cumsum(tp)
        fp_cum = np.cumsum(fp)
        precision = tp_cum / (tp_cum + fp_cum + 1e-7)
        recall = tp_cum / (n_gt + 1e-7)

        # 11-point interpolated AP
        ap = 0.0
        for thresh in np.linspace(0, 1, 11):
            prec_at = precision[recall >= thresh]
            ap += (prec_at.max() if len(prec_at) > 0 else 0.0) / 11
        aps.append(ap)

    return float(np.mean(aps)) if aps else 0.0


def validate_onnx(onnx_model: Path, val_yaml: Path) -> float:
    """Run ONNX inference on the validation set and compute mAP@0.5.

    Uses CPUExecutionProvider (deterministic, hardware-independent).
    """
    import cv2
    import numpy as np
    import onnxruntime as ort
    import yaml

    print(f"[ONNX] Loading model: {onnx_model}")
    session = ort.InferenceSession(
        str(onnx_model),
        providers=["CPUExecutionProvider"],
    )
    input_name: str = session.get_inputs()[0].name
    print(f"[ONNX] Session ready. Input name: {input_name}")

    # Load dataset config
    print(f"[ONNX] Loading dataset config: {val_yaml}")
    with open(val_yaml) as f:
        data_cfg: dict[str, Any] = yaml.safe_load(f)

    val_path = Path(data_cfg.get("val", ""))
    if not val_path.is_absolute():
        val_path = val_yaml.parent / val_path

    if not val_path.exists():
        print(f"ERROR: Validation image path not found: {val_path}", file=sys.stderr)
        sys.exit(1)

    # Gather image paths
    image_extensions = {".jpg", ".jpeg", ".png", ".bmp"}
    image_paths = sorted(
        p for p in val_path.rglob("*") if p.suffix.lower() in image_extensions
    )
    if not image_paths:
        print(f"ERROR: No images found in {val_path}", file=sys.stderr)
        sys.exit(1)

    # Locate labels directory (images/ -> labels/ convention)
    labels_path = Path(str(val_path).replace("images", "labels"))

    all_predictions: list[list[dict[str, Any]]] = []
    all_ground_truths: list[list[dict[str, Any]]] = []

    print(f"[ONNX] Running inference on {len(image_paths)} images...")
    for img_path in image_paths:
        # Load and preprocess
        img_bgr = cv2.imread(str(img_path))
        if img_bgr is None:
            print(f"  WARN: Could not read {img_path}, skipping.")
            all_predictions.append([])
            all_ground_truths.append([])
            continue

        orig_h, orig_w = img_bgr.shape[:2]
        scale = min(INPUT_SIZE / orig_h, INPUT_SIZE / orig_w)
        pad_w = (INPUT_SIZE - int(round(orig_w * scale))) // 2
        pad_h = (INPUT_SIZE - int(round(orig_h * scale))) // 2

        tensor_f32 = _preprocess_image(img_bgr)

        # Run inference
        outputs = session.run(None, {input_name: tensor_f32})
        raw = outputs[0].astype(np.float32)

        detections = _postprocess(raw)
        all_predictions.append(detections)

        # Load ground truth labels (YOLO txt format)
        label_path = labels_path / (img_path.stem + ".txt")
        gts: list[dict[str, Any]] = []
        if label_path.exists():
            with open(label_path) as lf:
                for line in lf:
                    parts = line.strip().split()
                    if len(parts) < 5:
                        continue
                    cls_id, cx, cy, w, h = int(parts[0]), *map(float, parts[1:5])
                    # Convert normalized [0,1] coords to 640px padded space
                    cx_px = cx * orig_w * scale + pad_w
                    cy_px = cy * orig_h * scale + pad_h
                    w_px = w * orig_w * scale
                    h_px = h * orig_h * scale
                    gts.append(
                        {
                            "class_id": cls_id,
                            "box": [cx_px, cy_px, w_px, h_px],
                        }
                    )
        all_ground_truths.append(gts)

    map50 = _compute_map50(all_predictions, all_ground_truths)
    print(f"[ONNX] mAP@0.5 = {map50:.4f}")
    return map50


def main() -> None:
    """Entry point: compare PT vs ONNX mAP@0.5 and assert regression threshold."""
    _check_dependencies()

    input_pt, onnx_model, val_yaml = _resolve_paths()

    print("=" * 60)
    print("PipeVision — PT vs ONNX mAP Regression Test")
    print("=" * 60)
    print(f"PT checkpoint  : {input_pt}")
    print(f"ONNX model     : {onnx_model}")
    print(f"Val dataset    : {val_yaml}")
    print(f"Delta threshold: |Δ mAP@0.5| < {MAP50_DELTA_THRESHOLD}")
    print()

    # Validate paths
    if not input_pt.exists():
        print(f"ERROR: PT checkpoint not found: {input_pt}", file=sys.stderr)
        sys.exit(1)
    if not onnx_model.exists():
        print(f"ERROR: ONNX model not found: {onnx_model}", file=sys.stderr)
        print("  Run model/export.py first.", file=sys.stderr)
        sys.exit(1)
    if not val_yaml.exists():
        print(f"ERROR: Validation YAML not found: {val_yaml}", file=sys.stderr)
        sys.exit(1)

    pt_map50 = validate_pt(input_pt, val_yaml)
    onnx_map50 = validate_onnx(onnx_model, val_yaml)

    delta = abs(pt_map50 - onnx_map50)
    passed = delta < MAP50_DELTA_THRESHOLD

    print()
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"  PT   mAP@0.5  : {pt_map50:.4f}")
    print(f"  ONNX mAP@0.5  : {onnx_map50:.4f}")
    print(f"  |Δ mAP@0.5|   : {delta:.4f}  (threshold: {MAP50_DELTA_THRESHOLD})")
    print(f"  Status        : {'PASS' if passed else 'FAIL'}")
    print("=" * 60)

    if not passed:
        print(
            f"\nFAIL: mAP regression {delta:.4f} exceeds threshold {MAP50_DELTA_THRESHOLD}.",
            file=sys.stderr,
        )
        print(
            "  Options:\n"
            "    1. Re-export with FP32 (remove half=True in export.py)\n"
            "    2. Check that the same val dataset is used for both runs\n"
            "    3. Verify ONNX model was not corrupted during export",
            file=sys.stderr,
        )
        sys.exit(1)

    print("\nVerification passed. ONNX model is within acceptable mAP tolerance.")


if __name__ == "__main__":
    main()
