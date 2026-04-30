# Session — work workflow (pipevision-ext-001)

**Started:** 2026-04-30
**Workflow:** `/work`
**User Request:** Sprint 1 (Model extraction + ONNX conversion) execution

## Context

- Plan already complete (see `.agents/results/plan-pipevision-ext-001.json`)
- Design doc: `docs/plans/pipevision-extension-design.md`
- Exec plan: `docs/exec-plans/active/pipevision-extension.md`
- Skipping `/work` Steps 1-3 (Analyze + PM Plan + Review) — already executed by `/plan` workflow
- Starting at Step 4 (Spawn agents)

## Sprint 1 — Backend-only (7 tasks)

| Task | Status |
|------|--------|
| T1.1 download.sh | PENDING — needs SageMaker S3 URI |
| T1.2 export.py | PENDING |
| T1.3 verify.py | PENDING |
| T1.4 metadata.yaml + README.md (model card) | PENDING |
| T1.5 upload.sh + HF Hub push | PENDING — needs HF username |
| T1.6 mise tasks | PENDING |
| T1.7 .gitignore additions | PENDING |

## Boundaries

- **Code/script authoring**: automated via `backend-engineer` agent
- **Actual execution** (S3 download, ONNX export, HF Hub push): manual by user (requires AWS + HF credentials)
- Reason: external system effects + user-owned credentials per CLAUDE.md "executing actions with care"

## User Confirmation Pending

Before spawning `backend-engineer`, need to confirm:
1. SageMaker S3 URI / AWS profile name
2. Hugging Face username + repo name
3. Python tool preference (uv / poetry / pip + venv / conda)
4. macOS Apple Silicon vs Intel (affects ultralytics install path)
