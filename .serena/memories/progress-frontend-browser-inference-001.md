# Progress — Sprint A + B (browser-inference-001)

**Completed:** 2026-05-15
**Owner:** frontend-engineer subagent (3 rounds) + main agent (lint cleanup + dep fix)

## Files added

- `src/features/inference/model-config.ts`
- `src/features/inference/runtime-select.ts`
- `src/features/inference/types.ts`
- `src/features/inference/preprocess.ts`
- `src/features/inference/postprocess.ts`
- `src/features/inference/nms.ts`
- `src/features/inference/inference-service.ts`
- `src/features/inference/use-inference.ts`
- `src/features/inference/fallback-spaces.ts`
- `src/lib/onnx/ort-loader.ts`
- `src/lib/onnx/sw-register.ts`
- `src/widgets/model-status-pill/model-status-pill.tsx`
- `src/widgets/model-status-pill/index.ts`
- `public/sw.js`
- `.env.example`

## Files edited

- `src/app/providers/model-provider.tsx` — full rewrite, 5-phase state machine
- `src/pages/detect/detect-page.tsx` — removed `runMockInference`, added loading-model/error states, dynamic imgW/imgH
- `src/pages/dashboard/dashboard-page.tsx` — StatCard dynamic, subscribe-only, removed vestigial `refreshKey`
- `src/widgets/app-sidebar/app-sidebar.tsx` — replaced static "Demo Mode" pill with `<ModelStatusPill>`
- `src/main.tsx` — SW registration in PROD only
- `vite.config.ts` — viteStaticCopy + optimizeDeps
- `package.json` + `bun.lock` — onnxruntime-web@^1.20.0, vite-plugin-static-copy@^4.1
- `src/widgets/detection-result-panel/detection-result-panel.tsx` — pre-existing lint debt: removed dead biome-ignore, moved progressbar role
- `src/widgets/history-table/history-table.tsx` — pre-existing lint debt: dropped redundant index in keys
- `src/widgets/recent-detections/recent-detections.tsx` — pre-existing: removed vestigial refreshKey prop
- `src/widgets/defect-distribution-chart/defect-distribution-chart.tsx` — pre-existing: removed vestigial refreshKey prop
- `src/pages/history/history-page.tsx` — pre-existing: added biome-ignore comment for useEffect refresh trigger

## Verification

```
bun run typecheck   → exit 0
bun run lint        → exit 0, 4 a11y warnings (all pre-existing role="progressbar" non-focusable patterns in detection-result-panel + defect-distribution-chart)
bun run build       → exit 0, dist contains assets/ort-wasm-simd-threaded.jsep-*.wasm (26MB, auto-bundled by Vite) + dist/ort/{ort-wasm.wasm, ort-wasm-simd.wasm, ...} (viteStaticCopy)
```

## Deviations from design

1. **vite-plugin-static-copy missing from devDependencies after initial agent pass** — added by main agent (`bun add -d vite-plugin-static-copy` → v4.1.0). Subagent forgot to install after referencing in vite.config.ts.
2. **Vite still bundles ort-wasm-simd-threaded.jsep-*.wasm into dist/assets/** despite our `numThreads=1` config. This is Vite's automatic asset linking from `onnxruntime-web` imports, not the `viteStaticCopy` we configured. Practical effect: 26MB extra wasm in the bundle that won't be used by client. Design specified `ort-wasm.wasm` + `ort-wasm-simd.wasm` only. Needs follow-up: add a `build.rollupOptions.external` rule or use ORT package subpath to suppress the threaded variant.
3. **Pre-existing lint debt fixed in-band** — `noArrayIndexKey` suppressions broken in current Biome version; redundant `${id}-${i}` keys simplified to just `${id}`. Pre-existing `useExhaustiveDependencies` on vestigial `refreshKey` props in two dashboard widgets resolved by removing the unused prop wiring.
4. **`a11y/useFocusableInteractive` not fixed** — bar-with-role="progressbar" in detection-result-panel (Sprint A+B move) + defect-distribution-chart (pre-existing). Both are warnings, not errors. Defer to QA pass.

## Out of scope (still TODO)

- T16 — index.html CSP meta
- T17 — .github/workflows/deploy.yml env injection
- T18 — vitest setup + unit tests
- T19 — Playwright E2E
- T20 — README update
- S1 — Spaces app deployment (Python)
- S2 — Actual VITE_MODEL_URL / VITE_MODEL_SHA256 values

## Tech debt added

- Vite bundles unused threaded WASM (26MB). Could be suppressed via build config or by importing a specific ORT distribution path. Track in `docs/plans/work/tech-debt-tracker.md` when created.

## Demo readiness

Code path is complete end-to-end. The Detect page will fail loudly with `phase: 'error', code: 'NETWORK'` until the user fills `.env`. With env populated, the path is: ensureReady → fetch model (SW caches if origin allowed) → SHA-256 verify (skipped if blank) → InferenceSession.create → warming run → ready → run() per click.
