# QA Fixes Applied — browser-inference-001 (round 2)

**Date:** 2026-05-15
**Source:** `qa-review-browser-inference-001` memory + `.agents/results/qa-review-browser-inference-001.md`

## Files touched

| Fix | File | Lines | What changed |
|---|---|---|---|
| S-1 HIGH | `src/features/inference/fallback-spaces.ts` | 24-29, 56-72, 123-133 | Bbox format from `[x1,y1,x2,y2]` to `[x,y,w,h]`. Adapter destructures correctly. Response narrowing hardened (S-3 LOW also resolved). |
| S-2 MEDIUM | `src/features/inference/model-config.ts` | 30-41 | `appendCacheKey(rawUrl, sha256)` appends `?v=<first 8 hex>` when SHA-256 is configured. Stale cached bytes from different model revisions become misses automatically. |
| P-1 MEDIUM | `vite.config.ts` | full rewrite | Replaced `vite-plugin-static-copy` with inline `copyOrtWasm()` plugin that flat-copies `node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded*.wasm` into `dist/ort/`. The plugin was creating nested `dist/ort/node_modules/onnxruntime-web/dist/...` paths regardless of `rename` option. `rollupOptions.external` regex also removed (didn't help; ORT bundles its own asset reference). |
| A-1 MEDIUM | `src/pages/detect/detect-page.tsx` | 99-104, 303-304 | `stateRegionRef` on `<main>` with `tabIndex={-1}`; `useEffect` on `pageState` moves focus to the active region. |
| C-1 MEDIUM | `src/app/providers/model-provider.tsx` | 151-158, 296 | `inferErrorCode(err)` maps `Error` with `code` tag first, `TypeError` to NETWORK, all else to RUNTIME. |

## Dependency change

- Removed: `vite-plugin-static-copy` (`bun remove vite-plugin-static-copy`) — replaced by 18-line inline plugin

## Verification

```
bun run typecheck   → exit 0
bun run lint        → exit 0, 4 a11y warnings (all pre-existing role="progressbar" + 2 in detect-page.tsx already present before A-1)
bun run build       → exit 0
                      dist/ort/ — flat layout, 4 wasm files (12-25 MB each)
                      dist/assets/ort-wasm-simd-threaded.jsep-*.wasm — 26 MB (unavoidable, ORT 1.26 bundles internally)
```

## Residual issues

### Partial / accepted

- **P-1 remainder**: Rollup still emits `dist/assets/ort-wasm-simd-threaded.jsep-*.wasm` (26 MB) due to ORT 1.26's internal `new URL(...)` asset reference. This file is **never loaded at runtime** because `ort.env.wasm.wasmPaths` points to `/pipevision-ai/ort/`. Net cost: one extra 26 MB file in `dist/` directory tree. Not in any HTML/JS reference path, but takes upload bandwidth on deploy. Tech debt — pin to ORT version that ships non-threaded variants, or post-build delete.

### LOW backlog (unchanged)

S-4 (SW error response body), P-2 (model download peak 2× memory), P-3 (input tensor copy), P-4 (893 KB main chunk), A-2 (progressbar tabIndex on pre-existing widgets), A-3 (fallback button aria-live), C-2 (singleton session identity tracking), C-3 (warming layout repeat), C-4 (dev-warn spam), C-5 (image-dropzone validation).

## Status

Sprint A + B with QA follow-up: **CLOSED**.
HIGH issues: 0 remaining.
MEDIUM: 1 partially resolved (P-1, see Residual), 4 fully resolved.
LOW: 10 in backlog (not blocking).

Ready for Sprint C (T16 CSP, T17 deploy.yml, T18 vitest, T19 Playwright) or Sprint D (T20 README).
