# Execution Plan — PipeVision AI Extension

**Session:** `pipevision-ext-001`
**Created:** 2026-04-30
**Owner:** Eunkwang Shin (Plumbers of UTS)
**Complexity:** Complex (5 active sprints + 2 future-work sprints, 53 tasks)
**Status:** Active

---

## Sources of Truth

| Artifact | Path |
|----------|------|
| Design Document | `docs/plans/pipevision-extension-design.md` |
| Plan JSON | `.agents/results/plan-pipevision-ext-001.json` |
| API/Module Contracts | `.agents/skills/_shared/core/api-contracts/pipevision-contracts.md` |
| Memory | `.serena/memories/plan-pipevision-extension.md` |
| Initial Experiment | `Assignment-3-PartC-JadynBraganza-26055044-2.pdf` (local) |
| Design System | `DESIGN.md` |
| Mockup | `gui-mockup.html` |

---

## Sprint Order & Gates

```
Sprint 1 (M1, P0, 1-2d) ──► Sprint 2 (M2, P0, 1d) ──► Sprint 3 (M3, P0, 3d) ──► Sprint 4 (M4, P1, 2d) ──► Sprint 5 (M5, P2, 1-2d) ──► [PUBLIC]
                                                                                                                 │
                                                                                                                 ├──► Sprint 6 (Future Work — Client, P3)
                                                                                                                 │
                                                                                                                 └──► Sprint 7 (Future Work — Model, P3)
```

**Hard gates** (must pass before next sprint starts):
- **Sprint 1**: ONNX export passes + `|Δ mAP@0.5| < 0.005` + HF Hub URL public
- **Sprint 2**: `bun run dev` shows sidebar + 4 empty routes + HF Spaces demo URL live
- **Sprint 3**: Desktop upload → bbox visualization < 3s after warmup, 7 classes correctly colored
- **Sprint 4**: All 4 pages match mockup + IndexedDB roundtrip works
- **Sprint 5**: Lighthouse Perf ≥85, A11y ≥95, public URL passes all verification scenarios

---

## Risk Register (Live)

| ID | Risk | Status | Mitigation Owner |
|----|------|--------|------------------|
| R1 | YOLO26m ONNX export fails | OPEN — verify in Sprint 1 | backend-engineer |
| R2 | mAP regression > 1% after FP16 | OPEN — `verify.py` enforces | backend-engineer |
| R3 | WebGPU unsupported on Safari | ACCEPTED — WASM fallback | frontend-engineer |
| R4 | First-load latency causes drop-off | OPEN — Service Worker + progress UI | frontend-engineer |
| R5 | HF Hub CORS / rate limit | OPEN — GitHub Releases fallback | backend-engineer |
| R6 | gh-pages 100MB single-file limit | RESOLVED — model is on HF Hub | — |
| R7 | Deadline miss | OPEN — HF Spaces ready by Sprint 2 keeps demo viable | all |
| R8 | Low mAP on Crack/Joint offset visible | ACCEPTED — Future Work cards on /models | — |
| R9 | Conversion env drift | OPEN — mise + pinned requirements.txt | backend-engineer |
| R10 | SageMaker .pt extraction difficulty | OPEN — Sprint 1.T1.1 first day | backend-engineer |

---

## Critical Path

```
T1.1 (S3 download)
  └─► T1.2 (ONNX export)
        └─► T1.3 (verify.py)
              └─► T1.5 (HF Hub upload)
                    └─► T3.1 (ORT runtime)
                          └─► T3.5 (model-provider)
                                └─► T3.15 (detect-page assembly)
                                      └─► T4.15 (auto-save to history)
                                            └─► T5.7 (production deploy)
```

If any node on the critical path slips by >2x its estimate, write a checkpoint and notify the user (per `_shared/core/difficulty-guide.md` Sprint Loop rules).

---

## Agent Workload Distribution

| Agent | Tasks | Notes |
|-------|-------|-------|
| backend-engineer | 14 (Sprint 1 + T2.1 + Sprint 7 + T6.3 collab) | Heavy at Sprint 1, distributed otherwise |
| frontend-engineer | 33 (most of S2-S6) | Dominant — UI + inference wiring |
| db-engineer | 2 (T4.1, T4.2) | IndexedDB schema and repository only |
| tf-infra-engineer | 3 (T2.4, T2.8, T5.7) | CI/CD + production deploy |
| qa-reviewer | 3 (T5.1, T5.2, T5.6) | Final-sprint audit |

---

## Recommended Execution Mode

**`/work` (sequential, with sprint gates)** is recommended over `/orchestrate` because:
1. Sprint 1 is a pre-flight risk check — its outcome could re-shape Sprints 2-5 (HF Spaces becomes primary path).
2. Sprints 3 and 4 share many frontend file paths; concurrent agents would conflict.
3. db-engineer (Sprint 4) and frontend-engineer (Sprint 4) can run partly in parallel within Sprint 4 if needed (T4.1+T4.2 are independent of T4.10-T4.13).

---

## Sprint Detail Summary

### Sprint 1 — M1: Model extraction + ONNX conversion (P0)
7 tasks. Backend-only. Outputs: HF Hub model URL.

### Sprint 2 — M2: HF Spaces fallback + project bootstrap (P0)
8 tasks. Backend (T2.1) + Frontend + tf-infra. Outputs: working dev env + live HF Spaces demo.

### Sprint 3 — M3: Detect page + inference module + model loading UX (P0) ⭐ Core
15 tasks. Frontend-only. Outputs: end-to-end browser inference.

### Sprint 4 — M4: Dashboard / History / Models pages (P1)
15 tasks. Frontend + db-engineer (2 tasks). Outputs: all 4 pages complete with IndexedDB.

### Sprint 5 — M5: Polish + deploy (P2)
7 tasks. Frontend + qa + tf-infra. Outputs: public URL.

### Sprint 6 — Future Work: Client (P3)
6 tasks. Post-launch. Prefetch, Web Worker, INT8/mobile, i18n, telemetry, video.

### Sprint 7 — Future Work: Model (P3)
6 tasks. ML retraining (SageMaker/Colab). PDF "Further Experiments" 6 items. Each completion re-runs Sprint 1.T1.2-T1.5.

---

## Checkpoint Protocol

Per `_shared/core/difficulty-guide.md`:
- At each Sprint Gate, record outcome here under the sprint's "Status" line
- If a sprint takes >2x estimated time, add a `## Checkpoint YYYY-MM-DD` section with what's blocked and why
- Update Risk Register status as risks resolve or new ones emerge

---

## Sprint Status

### Sprint 1 — Status: PENDING
- [ ] T1.1 download.sh
- [ ] T1.2 export.py
- [ ] T1.3 verify.py
- [ ] T1.4 metadata.yaml + README.md
- [ ] T1.5 upload.sh + HF Hub push
- [ ] T1.6 mise tasks
- [ ] T1.7 .gitignore

### Sprint 2 — Status: BLOCKED (by Sprint 1 gate)
### Sprint 3 — Status: BLOCKED (by Sprint 1, 2 gates)
### Sprint 4 — Status: BLOCKED (by Sprint 3 gate)
### Sprint 5 — Status: BLOCKED (by Sprint 4 gate)
### Sprint 6 — Status: DEFERRED (post-launch)
### Sprint 7 — Status: DEFERRED (out of v1 scope)

---

## Next Action

Run `/work` (or `/orchestrate` with caution) targeting **Sprint 1** first. The HF Hub model URL output of Sprint 1 unblocks Sprint 2 onward.
