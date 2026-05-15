# QA Review — browser-inference-001 (Sprint A + B)

**Date:** 2026-05-15
**Reviewer:** Inline (qa-reviewer subagent hit tool-use limit; main agent reviewed 4 highest-risk files)
**Full report:** `.agents/results/qa-review-browser-inference-001.md`

## Verdict

`PASS_WITH_FOLLOWUPS` — 1 HIGH + 4 MEDIUM + 8 LOW.

## Pre-launch blockers (must fix before Spaces fallback ships)

### S-1 HIGH — Spaces bbox format mismatch
`src/features/inference/fallback-spaces.ts:24-29, :60-71`
Adapter assumes `[x1,y1,x2,y2]` but Spaces Python app spec sends `[x,y,w,h]`. Current code computes `w = w_server - x_server`, producing wrong bboxes.

## This-sprint MEDIUM

- **S-2** SW caches bytes before SHA-256 verification → brief window for cache poisoning. Fix: add `?v=<sha-short>` to model URL (one-line in model-config).
- **P-1** Vite bundles 26MB `ort-wasm-simd-threaded.jsep.wasm` that never runs (numThreads=1). Fix: `rollupOptions.external` regex.
- **A-1** No focus management on Detect page state transitions. Fix: ref + tabIndex=-1 + .focus().
- **C-1** `(err as {code?}).code ?? "NETWORK"` mismaps real bugs to NETWORK. Fix: map by error class first.

## LOW (backlog)

S-3 Spaces response shape narrowing, S-4 SW error response leak, P-2 model download peak memory ~2×, P-3 input tensor copy, P-4 main chunk 893KB, A-2 progressbar focusability (pre-existing), A-3 fallback button aria-live, C-2 singleton session identity, C-3 warming layout repeat, C-4 dev-warn spam, C-5 image-dropzone validation (out of sprint scope).

## Positive notes

- aria-live on model-status-pill ✓
- `import type` discipline on ORT types ✓
- D-F (Tensor type boundary), D-G (Dashboard subscribe-only), D13 (no Workers) all honored ✓
- numThreads=1 ✓
- SW host whitelist ✓
- useInference aborts previous run on new run ✓
- clearObjectURL on file change ✓

## Recommendation

Re-spawn frontend-engineer for **S-1 + 4 MEDIUM** as a single follow-up. Estimated 30 min. Then declare Sprint A+B closed and proceed to Sprint C (T16-T19).
