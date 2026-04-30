# Memory — Plan: PipeVision AI Extension

**Session:** `pipevision-ext-001`
**Date:** 2026-04-30
**Phase:** Brainstorm + Plan complete; ready for `/work` execution

## TL;DR

Convert the team's YOLO26m sewer-defect detector (currently on AWS SageMaker) into a 100% browser-based public demo with **zero infrastructure operations**. Use case is dual: UTS assignment demo (A) + portfolio public demo (D).

## Key Decisions (D1–D15)

1. **D1** Use case A+D → 0 cost / 24/7 / public
2. **D2** Interaction level C+0-infra → browser inference
3. **D3** Desktop-first; mobile = samples-only fallback
4. **D4** Vite + React 19 + bun + TS, new project (mockup is reference only)
5. **D5** GitHub Pages (code) + Hugging Face Hub (model) split hosting
6. **D6** FP16 quantization (lossless mAP, 44MB)
7. **D7** NMS in TypeScript (export stability + slider control)
8. **D8** History via IndexedDB (Dexie) — preserves mockup demo value w/o server
9. **D9** Honest Detection Accuracy = mAP@0.5 = 0.44
10. **D10** Model loading UI in 3 places (sidebar pill / detect banner / dashboard stat)
11. **D11** Service Worker cache-first for model
12. **D12** Prefetch deferred to Future Work (Sprint 6)
13. **D13** Web Worker decision after profiling (Sprint 6)
14. **D14** HashRouter (gh-pages safe)
15. **D15** kebab-case for files and folders

## Architecture

```
SageMaker (best.pt) → local export (FP16 ONNX) → Hugging Face Hub
                                                        │
GitHub Pages (Vite/React SPA) ───── fetch ──────────────┘
                                                        │
                                                User Browser
                                                  ORT Web (WebGPU/WASM)
                                                  + Service Worker cache
                                                  + IndexedDB history

Fallback: HF Spaces (Gradio + .pt) for failure recovery + academic comparison
```

## Sprint Plan (5 active + 2 future-work, 53 tasks total)

| Sprint | Milestone | Priority | Days | Gate |
|--------|-----------|----------|------|------|
| 1 | M1 Model conversion | P0 | 1-2 | ONNX export OK + mAP regression < 1% + HF Hub URL |
| 2 | M2 HF Spaces fallback + bootstrap | P0 | 1 | dev env up + HF Spaces live |
| 3 | M3 Detect + inference + loading UX | P0 | 3 | Upload→bbox <3s, 7 classes correct |
| 4 | M4 Dashboard/History/Models | P1 | 2 | 4 pages match mockup + IndexedDB roundtrip |
| 5 | M5 Polish + deploy | P2 | 1-2 | Lighthouse Perf ≥85, A11y ≥95 |
| 6 | Future Client | P3 | post | prefetch / Web Worker / INT8 / i18n / telemetry / video |
| 7 | Future Model | P3 | OOS | PDF Further Experiments x6 (data aug, focal, attention, TAL, extended, FRCNN) |

## Critical Path

T1.1 → T1.2 → T1.3 → T1.5 → T3.1 → T3.5 → T3.15 → T4.15 → T5.7

## Risk Highlights

- **R1** YOLO26 ONNX export untested (2026 model). Mitigation: HF Spaces fallback ready by Sprint 2.
- **R7** Deadline. Mitigation: HF Spaces keeps demo viable even if browser path slips.
- **R8** Crack/Joint offset low mAP. Accepted; Future Work cards on /models add academic credibility.

## Agents

- backend-engineer: 14 tasks (heavy in Sprint 1, Sprint 7)
- frontend-engineer: 33 tasks (dominant)
- db-engineer: 2 tasks (T4.1, T4.2 IndexedDB)
- tf-infra-engineer: 3 tasks (CI/CD)
- qa-reviewer: 3 tasks (Sprint 5 audit)

## Recommended Execution

Use `/work` for sequential sprint-by-sprint execution. Avoid `/orchestrate` until Sprint 1 gate passes (could re-shape downstream).

## Linked Artifacts

- Design: `docs/plans/pipevision-extension-design.md`
- Plan JSON: `.agents/results/plan-pipevision-ext-001.json`
- Contracts: `.agents/skills/_shared/core/api-contracts/pipevision-contracts.md`
- Exec Plan: `docs/exec-plans/active/pipevision-extension.md`
- Mockup: `gui-mockup.html`
- Design System: `DESIGN.md`
