#!/usr/bin/env bash
# download.sh — Download best.pt from SageMaker S3 and extract to model/artifacts/
#
# SageMaker source variants:
#   (a) Training Job artifact (most common):
#       S3 path = s3://<bucket>/<training-job-name>/output/model.tar.gz
#       Set SAGEMAKER_MODEL_S3_URI to that full s3:// URI.
#       Example: SAGEMAKER_MODEL_S3_URI=s3://my-bucket/my-job/output/model.tar.gz
#
#   (b) Studio Notebook EBS (manual copy):
#       If you already have best.pt locally, copy it directly:
#         cp /path/to/best.pt model/artifacts/best.pt
#       Then skip this script entirely.
#
# Required env vars:
#   SAGEMAKER_MODEL_S3_URI   — full S3 URI to model.tar.gz
#
# Optional env vars:
#   AWS_PROFILE              — AWS CLI profile to use (default: "default")

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARTIFACTS_DIR="${SCRIPT_DIR}/artifacts"
ARCHIVE_PATH="${ARTIFACTS_DIR}/model.tar.gz"
CHECKPOINT_PATH="${ARTIFACTS_DIR}/best.pt"
AWS_PROFILE="${AWS_PROFILE:-default}"

# Validate required env var
if [[ -z "${SAGEMAKER_MODEL_S3_URI:-}" ]]; then
    echo "ERROR: SAGEMAKER_MODEL_S3_URI is not set." >&2
    echo "  Set it to the full S3 URI of your SageMaker model archive." >&2
    echo "  Example: export SAGEMAKER_MODEL_S3_URI=s3://my-bucket/my-job/output/model.tar.gz" >&2
    exit 1
fi

# Ensure artifacts directory exists
mkdir -p "${ARTIFACTS_DIR}"

echo "Downloading model archive from SageMaker S3..."
echo "  Source : ${SAGEMAKER_MODEL_S3_URI}"
echo "  Profile: ${AWS_PROFILE}"
echo "  Dest   : ${ARCHIVE_PATH}"

aws s3 cp \
    --profile "${AWS_PROFILE}" \
    "${SAGEMAKER_MODEL_S3_URI}" \
    "${ARCHIVE_PATH}"

echo "Extracting archive..."
tar -xzf "${ARCHIVE_PATH}" -C "${ARTIFACTS_DIR}"

# Validate extraction result
if [[ ! -f "${CHECKPOINT_PATH}" ]]; then
    echo "ERROR: Extraction completed but best.pt not found at ${CHECKPOINT_PATH}" >&2
    echo "  Contents of ${ARTIFACTS_DIR}:" >&2
    ls -lh "${ARTIFACTS_DIR}" >&2
    echo "" >&2
    echo "  If your archive uses a different path (e.g., model/best.pt inside the tar)," >&2
    echo "  locate it and move it manually:" >&2
    echo "    find ${ARTIFACTS_DIR} -name '*.pt'" >&2
    exit 1
fi

FILESIZE=$(du -sh "${CHECKPOINT_PATH}" | cut -f1)
echo ""
echo "Done. best.pt extracted successfully."
echo "  Path : ${CHECKPOINT_PATH}"
echo "  Size : ${FILESIZE}"
