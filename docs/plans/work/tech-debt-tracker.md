# Tech Debt Tracker

Tracks known debt across all plans. Add entries when shortcuts are taken during plan execution; remove entries when debt is resolved.

| # | Debt | Source | Severity | Proposed Resolution |
|---|------|--------|----------|--------------------|
| 1 | `ort-wasm-simd-threaded.jsep-*.wasm` (26 MB) bundled to `dist/assets/` despite `numThreads=1`. ORT 1.26 ships only threaded variants and Rollup emits the asset reference automatically. The file is never loaded at runtime (Serwist + `wasmPaths="/pipevision-ai/ort/"` route through `dist/ort/`), but takes upload bandwidth. | 001 (Sprint A) | LOW | Pin to an ORT version that ships non-threaded variants, or post-build delete the orphan asset. |
| 2 | Model download peak memory ~2× file size: streaming reader accumulates chunks in an array then copies into a `Uint8Array(loaded)`. For 44 MB FP16 ONNX → ~88 MB peak. | 001 (QA P-2) | LOW | Pre-allocate `Uint8Array(total)` when `content-length` is known and write chunks in-place. |
| 3 | Input tensor briefly held in two copies — letterbox Float32Array + ORT Tensor wrapping. ~10 MB peak for 640×640×3×4. | 001 (QA P-3) | LOW | Hand ownership to ORT (no further references after construction). Subsumed by future Web Worker migration (D13). |
| 4 | Main JS chunk 893 kB / 273 kB gzip — exceeds Vite 500 kB warning threshold. | 001 (QA P-4) | LOW | `build.rollupOptions.output.manualChunks` to split `dexie`, `recharts`, `react-router-dom` into vendor chunks. |
| 5 | 4 pre-existing `useFocusableInteractive` warnings on `role="progressbar"` elements (detection-result-panel + defect-distribution-chart). | pre-Sprint A | LOW | Add `tabIndex={0}` + visible focus outline. |
| 6 | Spaces fallback button announces loading text only via inner content swap (no `aria-live` or `aria-busy`). | 001 (QA A-3) | LOW | Wrap dynamic label in `<span aria-live="polite">` or add `aria-busy={spacesRunning}` to the button. |
| 7 | `inference-service` singleton doesn't track underlying `InferenceSession` identity — relies on `clearInferenceService()` discipline from `model-provider.retry()`. | 001 (QA C-2) | LOW | Add module-scope `cachedSession` ref; invalidate when session changes. |
| 8 | Dev-mode `console.warn` about missing SHA-256 fires on every `loadModel` call instead of once per session. | 001 (QA C-4) | LOW | Guard with a module-scope `warnedAboutSha = false` flag. |
| 9 | `image-dropzone` validation surface not reviewed for the real inference path — no explicit file-size guard or `accept` attribute audit. | 001 (QA C-5) | LOW | Verify `accept="image/jpeg,image/png,image/webp"` + size guard (≤10 MB). |
| 10 | Playwright E2E (`e2e/detect.spec.ts`) deferred — no integration test covers the upload → ready → bbox → IndexedDB happy path. | 001 (T19) | LOW | Add E2E covering the Detect page golden path against a stub or local-only deployment. |
| 11 | CSP `<meta http-equiv>` not in `index.html` — relies on browser defaults. Defense-in-depth gap. | 001 (T16) | LOW | Add CSP meta when the user reconsiders the trade-off; for now, dropped by user direction. |
| 12 | Web Worker inference deferred (D13) — main-thread inference can stutter UI on slow devices. | 001 (D13) | MEDIUM | Migrate `inference-service.ts` boundary to a Worker once a profile justifies the cost. |
| 13 | `.agents/results/plan-browser-inference-001.json` task statuses not updated to match the human tracker (still all TODO). | 001 (bookkeeping) | LOW | Sync the JSON statuses or remove the JSON file once orchestrator-style consumers are not needed. |

## Notes

- Review periodically; debt items can become plans themselves.
- "Source" column references the plan number where the debt was introduced; see `docs/plans/work/{NNN}-*.md`.
- Severity uses the same scale as QA reviews (CRITICAL / HIGH / MEDIUM / LOW).
