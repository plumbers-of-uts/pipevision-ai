#!/usr/bin/env bash
# upload.sh — Create the Hugging Face Hub model repo and push ONNX artifacts.
#
# Prerequisites:
#   Run `hf auth login` once before this script, OR set the HF_TOKEN
#   environment variable. The token needs write access to your HF account.
#   Install the CLI: `uv sync` (huggingface-hub is declared in pyproject.toml),
#   which provides the modern `hf` command (replaces the deprecated
#   `huggingface-cli`).
#
# Required env vars:
#   HF_USER   Your Hugging Face username (e.g. export HF_USER=gracefullight)
#
# Uploaded files (paths in the repo match VITE_MODEL_URL in .env.local):
#   yolo26m-seg-fp16.onnx  — end-to-end (NMS-included) seg model, FP16
#   metadata.yaml          — class definitions, output shapes, inference thresholds
#   README.md              — Hugging Face Hub model card

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARTIFACTS_DIR="${SCRIPT_DIR}/artifacts"
REPO_NAME="${HF_REPO_NAME:-pipevision-yolo26m-seg}"
ONNX_FILE="yolo26m-seg-fp16.onnx"

# Validate required env var
if [[ -z "${HF_USER:-}" ]]; then
    echo "ERROR: HF_USER is not set." >&2
    echo "  Set it to your Hugging Face username:" >&2
    echo "    export HF_USER=<your-hf-username>" >&2
    exit 1
fi

REPO_ID="${HF_USER}/${REPO_NAME}"
ONNX_PATH="${ARTIFACTS_DIR}/${ONNX_FILE}"

# Check required files
for f in "${ONNX_PATH}" "${SCRIPT_DIR}/metadata.yaml" "${SCRIPT_DIR}/README.md"; do
    if [[ ! -f "${f}" ]]; then
        echo "ERROR: Required file not found: ${f}" >&2
        [[ "${f}" == "${ONNX_PATH}" ]] && echo "  Run model/export.py first." >&2
        exit 1
    fi
done

echo ""
echo "Creating Hugging Face Hub model repo (idempotent)..."
echo "  Repo: ${REPO_ID}"

# Create repo — exit gracefully if it already exists
hf repo create "${REPO_ID}" --repo-type model 2>&1 | grep -v "already" || true

echo ""
echo "Uploading artifacts to https://huggingface.co/${REPO_ID} ..."

# Upload ONNX model under the canonical filename the frontend resolves.
hf upload "${REPO_ID}" "${ONNX_PATH}" "${ONNX_FILE}" \
    --repo-type model \
    --commit-message "feat: upload 6-class yolo26m-seg ONNX FP16 (NMS-included)"

# Upload metadata.yaml
hf upload "${REPO_ID}" "${SCRIPT_DIR}/metadata.yaml" "metadata.yaml" \
    --repo-type model \
    --commit-message "docs: update model metadata for 6-class pipeline-defect set"

# Upload README.md (model card)
hf upload "${REPO_ID}" "${SCRIPT_DIR}/README.md" "README.md" \
    --repo-type model \
    --commit-message "docs: update model card for 6-class pipeline-defect set"

echo ""
echo "Upload complete. Public URLs:"
echo "  Model : https://huggingface.co/${REPO_ID}/resolve/main/${ONNX_FILE}"
echo "  Meta  : https://huggingface.co/${REPO_ID}/resolve/main/metadata.yaml"
echo "  Card  : https://huggingface.co/${REPO_ID}"
