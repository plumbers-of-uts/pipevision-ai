"""export.py — Export YOLO26m best.pt to ONNX FP16 with optional ORT graph optimization.

Usage:
    uv run python model/export.py

Environment variables:
    INPUT_PT    Path to source .pt checkpoint (default: model/artifacts/best.pt)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _resolve_paths() -> tuple[Path, Path, Path]:
    """Resolve input and output file paths from env vars or defaults."""
    script_dir = Path(__file__).parent
    artifacts_dir = script_dir / "artifacts"

    input_pt_env = os.environ.get("INPUT_PT", "")
    if input_pt_env:
        input_pt = Path(input_pt_env)
    else:
        input_pt = artifacts_dir / "best.pt"

    onnx_fp16 = artifacts_dir / "yolo26m-fp16.onnx"
    onnx_opt = artifacts_dir / "yolo26m-fp16-opt.onnx"

    return input_pt, onnx_fp16, onnx_opt


def export_to_onnx(input_pt: Path, onnx_fp16: Path) -> None:
    """Load best.pt via ultralytics.YOLO and export to ONNX FP16.

    Export parameters are fixed per design contract §5.2:
    - format='onnx'       : ONNX serialisation
    - half=True           : FP16 weights (~44 MB, near-zero mAP loss)
    - dynamic=False       : Fixed [1, 3, 640, 640] input — required for WebGPU
    - simplify=True       : onnx-simplifier constant folding
    - imgsz=640           : Square input matching training resolution
    - opset=17            : ORT Web compatible (>=14), needed for modern ops
    - nms=False           : NMS handled in TypeScript client (C1 contract)
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: ultralytics not installed. Run: uv sync", file=sys.stderr)
        sys.exit(1)

    if not input_pt.exists():
        print(f"ERROR: Checkpoint not found: {input_pt}", file=sys.stderr)
        print("  Run model/download.sh first, or set INPUT_PT env var.", file=sys.stderr)
        sys.exit(1)

    print(f"Loading model from: {input_pt}")
    model = YOLO(str(input_pt))

    print("Exporting to ONNX FP16 (this may take 1-2 minutes)...")
    exported_path: str = model.export(
        format="onnx",
        half=True,
        dynamic=False,
        simplify=True,
        imgsz=640,
        opset=17,
        nms=False,
    )

    # Ultralytics exports to the same directory as the .pt by default.
    # Move to the canonical artifacts path if needed.
    exported = Path(exported_path)
    if exported.resolve() != onnx_fp16.resolve():
        onnx_fp16.parent.mkdir(parents=True, exist_ok=True)
        exported.rename(onnx_fp16)
        print(f"Moved exported model to: {onnx_fp16}")
    else:
        print(f"Exported model at: {onnx_fp16}")

    size_mb = onnx_fp16.stat().st_size / (1024 * 1024)
    print(f"  File size: {size_mb:.1f} MB")


def optimize_onnx(onnx_fp16: Path, onnx_opt: Path) -> bool:
    """Apply ORT graph optimizations (constant fold + op fusion) if available.

    Returns True if optimization succeeded, False if onnxruntime.transformers
    is unavailable or optimization fails (non-fatal — caller keeps FP16 original).
    """
    try:
        from onnxruntime.transformers import optimizer as ort_optimizer  # type: ignore[import-untyped]
    except ImportError:
        print(
            "INFO: onnxruntime.transformers not available. "
            "Skipping ORT graph optimization (FP16 ONNX is already simplified)."
        )
        return False

    print("Applying ORT graph optimization...")
    try:
        opt_model = ort_optimizer.optimize_model(
            str(onnx_fp16),
            model_type="bert",  # generic optimizer path; not BERT-specific in effect
            opt_level=1,
            use_gpu=False,
        )
        opt_model.save_model_to_file(str(onnx_opt))
        size_mb = onnx_opt.stat().st_size / (1024 * 1024)
        print(f"Optimized model saved: {onnx_opt}  ({size_mb:.1f} MB)")
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"WARN: ORT optimization failed ({exc}). Using simplified ONNX as-is.")
        return False


def main() -> None:
    """Entry point: export .pt -> ONNX FP16, then attempt ORT optimization."""
    input_pt, onnx_fp16, onnx_opt = _resolve_paths()

    print("=" * 60)
    print("PipeVision — YOLO26m ONNX Export")
    print("=" * 60)
    print(f"Input checkpoint : {input_pt}")
    print(f"ONNX FP16 output : {onnx_fp16}")
    print(f"ORT opt output   : {onnx_opt}")
    print()

    export_to_onnx(input_pt, onnx_fp16)

    optimized = optimize_onnx(onnx_fp16, onnx_opt)

    final_model = onnx_opt if optimized else onnx_fp16
    final_size_mb = final_model.stat().st_size / (1024 * 1024)

    print()
    print("=" * 60)
    print("Export complete")
    print(f"  Final model : {final_model}")
    print(f"  Final size  : {final_size_mb:.1f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()
