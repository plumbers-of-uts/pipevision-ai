#!/usr/bin/env bash
# upload.sh — Create Hugging Face Hub model repo and push ONNX model artifacts.
#
# Prerequisites:
#   Run `huggingface-cli login` once before this script, OR set the HF_TOKEN
#   environment variable. The token needs write access to your HF account.
#   Install huggingface-hub: uv sync (already declared in pyproject.toml)
#
# Required env vars:
#   HF_USER   Your Hugging Face username (e.g. export HF_USER=myusername)
#
# The following files are uploaded:
#   model.onnx    — optimized (yolo26m-fp16-opt.onnx) if present, else yolo26m-fp16.onnx
#   metadata.yaml — class definitions and inference thresholds
#   README.md     — Hugging Face Hub model card

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARTIFACTS_DIR="${SCRIPT_DIR}/artifacts"
REPO_NAME="pipevision-yolo26m"

# Validate required env var
if [[ -z "${HF_USER:-}" ]]; then
    echo "ERROR: HF_USER is not set." >&2
    echo "  Set it to your Hugging Face username:" >&2
    echo "    export HF_USER=<your-hf-username>" >&2
    exit 1
fi

REPO_ID="${HF_USER}/${REPO_NAME}"

# Resolve ONNX model to upload (prefer optimized)
ONNX_OPT="${ARTIFACTS_DIR}/yolo26m-fp16-opt.onnx"
ONNX_BASE="${ARTIFACTS_DIR}/yolo26m-fp16.onnx"

if [[ -f "${ONNX_OPT}" ]]; then
    ONNX_PATH="${ONNX_OPT}"
    echo "Using optimized ONNX model: ${ONNX_OPT}"
elif [[ -f "${ONNX_BASE}" ]]; then
    ONNX_PATH="${ONNX_BASE}"
    echo "Using base ONNX model: ${ONNX_BASE}"
else
    echo "ERROR: No ONNX model found in ${ARTIFACTS_DIR}." >&2
    echo "  Run model/export.py first." >&2
    exit 1
fi

# Check required non-binary files
for f in "${SCRIPT_DIR}/metadata.yaml" "${SCRIPT_DIR}/README.md"; do
    if [[ ! -f "${f}" ]]; then
        echo "ERROR: Required file not found: ${f}" >&2
        exit 1
    fi
done

echo ""
echo "Creating Hugging Face Hub model repo (idempotent)..."
echo "  Repo: ${REPO_ID}"

# Create repo — exit gracefully if it already exists
huggingface-cli repo create "${REPO_NAME}" \
    --type model \
    --private false 2>&1 | grep -v "already exists" || true

echo ""
echo "Uploading artifacts to https://huggingface.co/${REPO_ID} ..."

# Upload ONNX model as model.onnx (canonical name for frontend)
huggingface-cli upload "${REPO_ID}" \
    "${ONNX_PATH}" \
    "model.onnx" \
    --commit-message "feat: upload ONNX FP16 model"

# Upload metadata.yaml
huggingface-cli upload "${REPO_ID}" \
    "${SCRIPT_DIR}/metadata.yaml" \
    "metadata.yaml" \
    --commit-message "feat: upload model metadata"

# Upload README.md (model card)
huggingface-cli upload "${REPO_ID}" \
    "${SCRIPT_DIR}/README.md" \
    "README.md" \
    --commit-message "feat: upload model card"

echo ""
echo "Upload complete. Public URLs:"
echo "  Model  : https://huggingface.co/${HF_USER}/${REPO_NAME}/resolve/main/model.onnx"
echo "  Meta   : https://huggingface.co/${HF_USER}/${REPO_NAME}/resolve/main/metadata.yaml"
echo "  Card   : https://huggingface.co/${HF_USER}/${REPO_NAME}"
echo ""
echo "CORS-friendly raw download URLs (for onnxruntime-web):"
echo "  https://huggingface.co/${HF_USER}/${REPO_NAME}/resolve/main/model.onnx"
