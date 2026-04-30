# PipeVision Model Pipeline — Usage Guide

Step-by-step instructions for running the Sprint 1 model conversion pipeline locally.

---

## Prerequisites

| Tool          | Install                          | Notes                         |
|--------------|----------------------------------|-------------------------------|
| uv (Astral)  | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | Python package manager |
| mise          | `curl https://mise.jdx.dev/install.sh \| sh` | Runtime + task runner |
| AWS CLI v2   | https://aws.amazon.com/cli/      | Required for download.sh only |
| huggingface-cli | installed via `uv sync` below | Required for upload.sh only  |

Python 3.11 is pinned in `model/.python-version` and managed by mise.

---

## Environment Variables

Set these before running the pipeline. Never commit them to source control.

| Variable                 | Required | Default    | Description                                         |
|--------------------------|----------|------------|-----------------------------------------------------|
| `SAGEMAKER_MODEL_S3_URI` | Yes (step 3) | —      | Full S3 URI to `model.tar.gz` (Training Job output) |
| `AWS_PROFILE`            | No       | `default`  | AWS CLI profile for S3 access                       |
| `HF_USER`                | Yes (step 6) | —      | Your Hugging Face username                          |
| `HF_TOKEN`               | No       | —          | HF access token (alternative to `huggingface-cli login`) |
| `INPUT_PT`               | No       | `model/artifacts/best.pt` | Override path to source checkpoint |
| `ONNX_MODEL`             | No       | `model/artifacts/yolo26m-fp16-opt.onnx` | Override path to ONNX model for verify |
| `VAL_DATASET_YAML`       | Yes (step 5) | `data.yaml` in cwd | Path to validation dataset YAML |

Export env vars in your shell before running:

```bash
export SAGEMAKER_MODEL_S3_URI="s3://my-bucket/my-training-job/output/model.tar.gz"
export AWS_PROFILE="default"
export HF_USER="<your-hf-username>"
export VAL_DATASET_YAML="/path/to/your/dataset/data.yaml"
```

---

## Step 1 — Install Python dependencies

Run from the project root. This creates a virtual environment inside `model/.venv/` and installs all packages declared in `model/pyproject.toml`.

```bash
cd model
uv sync
cd ..
```

Alternatively, use mise (runs from project root):

```bash
mise install
```

---

## Step 2 — (Optional) Authenticate with Hugging Face

Required only for step 6 (upload). Skip if you set `HF_TOKEN` instead.

```bash
uv run --project model huggingface-cli login
```

---

## Step 3 — Download best.pt from SageMaker S3

Downloads `model.tar.gz` from your SageMaker training job output bucket and extracts `best.pt` to `model/artifacts/best.pt`.

```bash
bash model/download.sh
# or: mise run model:download
```

**Alternative (SageMaker Studio Notebook EBS)**: If you already have `best.pt` locally, copy it directly and skip this step:

```bash
mkdir -p model/artifacts
cp /path/to/best.pt model/artifacts/best.pt
```

After this step, verify the file exists:

```bash
ls -lh model/artifacts/best.pt
```

---

## Step 4 — Export to ONNX FP16

Converts `best.pt` to `model/artifacts/yolo26m-fp16.onnx` and attempts ORT graph optimization to produce `model/artifacts/yolo26m-fp16-opt.onnx`. Takes 1-5 minutes on Apple Silicon.

```bash
uv run --project model python model/export.py
# or: mise run model:export
```

Expected output:

```
PipeVision — YOLO26m ONNX Export
Input checkpoint : model/artifacts/best.pt
ONNX FP16 output : model/artifacts/yolo26m-fp16.onnx
ORT opt output   : model/artifacts/yolo26m-fp16-opt.onnx
...
Export complete
  Final model : model/artifacts/yolo26m-fp16-opt.onnx
  Final size  : ~44.0 MB
```

If ORT optimization is unavailable, the simplified ONNX (`yolo26m-fp16.onnx`) is used as the final artifact.

---

## Step 5 — Run mAP regression test

Compares mAP@0.5 between the PyTorch `.pt` model and the exported ONNX model on the validation set (196 images). Exits with code 1 if `|Δ mAP@0.5| >= 0.005`.

```bash
VAL_DATASET_YAML=/path/to/dataset/data.yaml \
  uv run --project model python model/verify.py
# or: VAL_DATASET_YAML=... mise run model:verify
```

Expected output on pass:

```
RESULTS
  PT   mAP@0.5  : 0.4390
  ONNX mAP@0.5  : 0.4385
  |Δ mAP@0.5|   : 0.0005  (threshold: 0.005)
  Status        : PASS
```

If the test fails (`FAIL` status), options are:
1. Re-export with `half=False` in `model/export.py` to use FP32 (larger file, no precision loss)
2. Confirm the same `data.yaml` is used for both PT and ONNX runs
3. See design doc §9 risk R2 for further guidance

---

## Step 6 — Push to Hugging Face Hub

Creates the `pipevision-yolo26m` model repository (public, idempotent) and uploads `model.onnx`, `metadata.yaml`, and `README.md`.

```bash
bash model/upload.sh
# or: mise run model:upload
```

Expected output:

```
Upload complete. Public URLs:
  Model  : https://huggingface.co/<HF_USER>/pipevision-yolo26m/resolve/main/model.onnx
  Meta   : https://huggingface.co/<HF_USER>/pipevision-yolo26m/resolve/main/metadata.yaml
  Card   : https://huggingface.co/<HF_USER>/pipevision-yolo26m
```

After upload, open the model card URL to verify the repo is public and the model card renders correctly.

---

## Post-Upload: Record the MD5 hash

Update `model/metadata.yaml` with the actual `source_pt_md5` value to enable frontend cache invalidation:

```bash
md5sum model/artifacts/best.pt
# macOS: md5 model/artifacts/best.pt
```

Copy the hash into `model/metadata.yaml` under `model.source_pt_md5`, then re-upload:

```bash
huggingface-cli upload "${HF_USER}/pipevision-yolo26m" model/metadata.yaml metadata.yaml \
  --commit-message "fix: add source_pt_md5 for cache invalidation"
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `best.pt not found` after tar extraction | Archive uses a nested path (e.g., `model/best.pt`) | `find model/artifacts -name '*.pt'` then move |
| `huggingface_hub.errors.RepositoryNotFoundError` | `HF_USER` wrong or not logged in | `huggingface-cli whoami` to check, re-login |
| `ORT optimization failed` | `onnxruntime.transformers` API mismatch | Harmless — base FP16 ONNX is used |
| `verify.py FAIL` with delta > 0.005 | Unexpected FP16 precision loss | Re-export with `half=False`, re-verify |
| `No images found` in verify.py | Wrong `VAL_DATASET_YAML` path | Check `val:` key in your data.yaml points to correct images dir |

---

## File Layout

```
model/
├── .python-version        # pinned to 3.11 (tracked in git)
├── pyproject.toml         # uv dependencies
├── usage.md               # this file
├── README.md              # Hugging Face Hub model card (uploaded)
├── metadata.yaml          # class definitions + inference defaults (uploaded)
├── download.sh            # SageMaker S3 -> model/artifacts/best.pt
├── export.py              # best.pt -> yolo26m-fp16[-opt].onnx
├── verify.py              # PT vs ONNX mAP regression test
├── upload.sh              # push artifacts to HF Hub
└── artifacts/             # gitignored — binary files live here
    ├── best.pt
    ├── yolo26m-fp16.onnx
    └── yolo26m-fp16-opt.onnx
```
