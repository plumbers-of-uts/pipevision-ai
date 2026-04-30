# Backend Engineer Result — pipevision-ext-001 Sprint 1

**Status**: COMPLETED
**Date**: 2026-04-30
**Agent**: backend-engineer
**Session**: pipevision-ext-001

---

## 1. Files Created

| File | Task | Notes |
|------|------|-------|
| `model/.python-version` | T1.6 | Pins Python 3.11; tracked in git (root /.python-version is gitignored) |
| `model/pyproject.toml` | Additional | uv-compatible project; 9 runtime deps, 2 optional dev deps |
| `model/download.sh` | T1.1 | SageMaker S3 download + extraction with validation |
| `model/export.py` | T1.2 | PT -> ONNX FP16, optional ORT graph optimization |
| `model/verify.py` | T1.3 | PT vs ONNX mAP@0.5 regression test, sys.exit(1) on failure |
| `model/metadata.yaml` | T1.4 | C2 contract-compliant; test + validation metrics split |
| `model/README.md` | T1.4 | HF Hub model card with YAML frontmatter and full metrics tables |
| `model/upload.sh` | T1.5 | HF Hub repo create (idempotent) + 3-file upload |
| `model/usage.md` | Additional | Step-by-step workspace instructions; env var table; troubleshooting |
| `model/artifacts/` | T1.1 | Empty directory (gitignored; placeholder for binary artifacts) |
| `mise.toml` | T1.6 | New file; [tools] python=3.11, uv=latest; 4 model:* tasks |

---

## 2. Files Modified

| File | Task | Change |
|------|------|--------|
| `.gitignore` | T1.7 | Appended Sprint 1 patterns; preserved existing .DS_Store entries |

Appended patterns:
```
# Sprint 1 — model artifacts
model/artifacts/
model/.venv/
*.onnx
*.pt
*.tar.gz
__pycache__/
*.pyc
/.python-version
```

Note: `model/.python-version` is tracked (no leading slash). Only root-level `.python-version` is ignored via `/.python-version`.

---

## 3. Placeholders Flagged for User

| Placeholder | Location | Action Required |
|-------------|----------|-----------------|
| `${SAGEMAKER_MODEL_S3_URI}` | `model/download.sh`, `mise.toml` model:download task | Set to full S3 URI of SageMaker training job output archive |
| `${AWS_PROFILE}` | `model/download.sh` | Set if not using `default` AWS CLI profile |
| `${HF_USER}` | `model/upload.sh`, `mise.toml` model:upload task | Set to your Hugging Face username before running upload |
| `model.source_pt_md5` | `model/metadata.yaml` line with `source_pt_md5: ""` | Populate with `md5sum model/artifacts/best.pt` after download, then re-upload metadata.yaml |
| Per-class precision/recall in `model/README.md` | Metrics tables | Full per-class P/R values were not in extracted PDF data; only mAP@0.5 per class is filled. Fill in from the actual PDF table rows if available. |

---

## 4. R1 Risk Note — YOLO26m ONNX Export Feasibility

**Risk**: `model/export.py` calls `ultralytics.YOLO.export()` with `half=True, opset=17, nms=False`. The key concerns:

1. **YOLO26m is not yet in Ultralytics main** (as of August 2025 knowledge cutoff). If `ultralytics` does not recognize the YOLO26m architecture in its model registry, `YOLO("best.pt")` will raise an error or silently fall back to a wrong architecture. Mitigation: verify the version of Ultralytics used during training matches the version in `pyproject.toml` (`ultralytics>=8.3`). If there is a mismatch, pin to the exact training version (e.g., `ultralytics==8.2.x`).

2. **`half=True` on CPU during export**: Ultralytics performs a forward pass on the device during ONNX export. On Apple Silicon (MPS) with FP16, some ops may not be supported. The export falls back to CPU if MPS is unavailable, which is safe but slower. If export hangs or throws a device error, add `device='cpu'` explicitly to the `.export()` call in `model/export.py`.

3. **opset=17 and ORT Web**: ORT Web currently ships opset 17 support but some ops (e.g., GroupNorm, MHSA variants used in newer YOLO backbones) may not be supported in the WASM backend. Verify the exported graph with `python -c "import onnx; m=onnx.load('model/artifacts/yolo26m-fp16.onnx'); onnx.checker.check_model(m); print('OK')"` and test in ORT Web before frontend integration.

4. **ORT graph optimizer `model_type='bert'`**: The `onnxruntime.transformers.optimizer` with `model_type='bert'` applies generic optimizations (constant fold, layer norm fusion). For YOLO detection heads, this is safe but may not produce significant gains. If the optimizer raises on an unrecognized op, the `except` clause in `optimize_onnx()` catches it gracefully and the un-optimized FP16 ONNX is used as the final artifact.

**Fallback path** (R1 mitigated by sprint-2 T2.1): If ONNX export fails entirely, the HF Spaces Gradio app (sprint-2) serves as the primary demo path using the original `.pt` file directly.

---

## 5. Acceptance Criteria Checklist

- [x] T1.1: download.sh downloads model.tar.gz, extracts best.pt, validates extraction, documents both SageMaker source variants
- [x] T1.2: export.py outputs yolo26m-fp16.onnx, uses exact params (format=onnx, half=True, dynamic=False, simplify=True, imgsz=640, opset=17, nms=False), attempts ORT optimization, logs file size
- [x] T1.3: verify.py runs inference on val set for both PT and ONNX, computes mAP@0.5, asserts |delta| < 0.005, sys.exit(1) on fail, prints summary
- [x] T1.4: metadata.yaml conforms to C2 contract (model, classes x7 with severity, inference defaults, metrics test+validation split); README.md has YAML frontmatter, all required sections
- [x] T1.5: upload.sh creates HF Hub repo idempotently, uploads model.onnx + metadata.yaml + README.md, echoes resolved URLs
- [x] T1.6: mise.toml created with [tools] python=3.11, uv=latest; 4 model:* tasks each with description and run
- [x] T1.7: .gitignore preserves .DS_Store entries, appends 8 new patterns, /.python-version uses leading slash correctly
- [x] Additional: model/pyproject.toml valid TOML, requires-python=">=3.11,<3.13", all 9 deps declared
- [x] Additional: model/.python-version = "3.11"
- [x] Additional: model/usage.md with 6-step instructions, env var table, troubleshooting
- [x] Syntax: `bash -n model/download.sh` exit 0
- [x] Syntax: `bash -n model/upload.sh` exit 0
- [x] Syntax: `python -m py_compile model/export.py` exit 0
- [x] Syntax: `python -m py_compile model/verify.py` exit 0
- [x] YAML: metadata.yaml parses cleanly, all 7 classes present, metrics values correct
- [x] TOML: model/pyproject.toml and mise.toml parse cleanly
- [x] No external commands executed (no aws s3 cp, no huggingface-cli, no uv sync, no pip install)

---

## 6. What User Needs to Do Next (in order)

1. **Set environment variables**:
   ```bash
   export SAGEMAKER_MODEL_S3_URI="s3://<bucket>/<job>/output/model.tar.gz"
   export AWS_PROFILE="default"          # or your profile name
   export HF_USER="<your-hf-username>"
   export VAL_DATASET_YAML="/path/to/dataset/data.yaml"
   ```

2. **Install Python dependencies**:
   ```bash
   cd model && uv sync && cd ..
   # or: mise install && uv sync --project model
   ```

3. **Authenticate with Hugging Face** (once):
   ```bash
   uv run --project model huggingface-cli login
   ```

4. **Run the pipeline**:
   ```bash
   mise run model:download   # or: bash model/download.sh
   mise run model:export     # or: uv run --project model python model/export.py
   mise run model:verify     # or: VAL_DATASET_YAML=... uv run --project model python model/verify.py
   mise run model:upload     # or: bash model/upload.sh
   ```

5. **After upload**: record `md5sum model/artifacts/best.pt` into `model/metadata.yaml` under `model.source_pt_md5`, then re-upload the metadata file.

6. **Hand off to Sprint 2**: T2.1 (HF Spaces Gradio fallback) and T2.2 (Vite/React bootstrap) can now proceed in parallel. Frontend sprint-3 is unblocked once the HF Hub model URL is confirmed public.
