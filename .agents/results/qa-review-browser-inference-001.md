# QA Review — Browser Inference Finalization (Sprint A + B)

**Session:** browser-inference-001
**Date:** 2026-05-15
**Reviewer:** Inline QA pass (qa-reviewer subagent hit tool-use limit during exploration; review performed by main agent on the four highest-risk surfaces)
**Scope:** T1–T15 deliverables — `src/features/inference/`, `src/lib/onnx/`, `src/widgets/model-status-pill/`, `public/sw.js`, `src/app/providers/model-provider.tsx`, `src/pages/detect/detect-page.tsx`, `src/pages/dashboard/dashboard-page.tsx`, `src/widgets/app-sidebar/app-sidebar.tsx`, `src/main.tsx`, `vite.config.ts`

Out of scope: T16 CSP, T17 deploy.yml, T18 vitest, T19 Playwright, T20 README, Python Spaces app.

---

## Security

### S-1 HIGH — Spaces fallback bbox format mismatch (contract drift)
**File**: `src/features/inference/fallback-spaces.ts:24-29`, `:60-71`
**What**: The adapter's `SpacesDetection.bbox` type comment says `[x1, y1, x2, y2]` and the adapter computes `w = x2 - x1`. But the Python Spaces app spec in `docs/plans/work/001-browser-inference-finalization.md` (decision log entry for S1) returns `bbox: [x, y, w, h]` (`float(x2 - x1)` and `float(y2 - y1)`).
**Why it matters**: When the user clicks "Try Hugging Face Spaces fallback," all bbox widths/heights are computed as `w_server - x_server` and `h_server - y_server`, producing wildly wrong rectangles (often negative w/h, or covering wrong regions). This is the user-visible failure mode promised as a graceful fallback.
**Fix**: Treat server response as `[x, y, w, h]`. Replace the adapter:
```ts
interface SpacesDetection {
  class_id: number;
  score: number;
  /** [x, y, w, h] in original image pixels, top-left origin (per Spaces app spec) */
  bbox: [number, number, number, number];
}

function adaptSpacesDetections(spacesDetections: SpacesDetection[]): Detection[] {
  return spacesDetections.map((sd) => {
    const meta = CLASS_BY_ID[sd.class_id];
    const [x, y, w, h] = sd.bbox;
    return {
      id: uuidv4(),
      classId: sd.class_id,
      className: meta?.name ?? `Class ${sd.class_id}`,
      severity: meta?.severity ?? "low",
      confidence: sd.score,
      bbox: { x: x ?? 0, y: y ?? 0, w: w ?? 0, h: h ?? 0 },
      color: meta?.color ?? "#888888",
    };
  });
}
```

### S-2 MEDIUM — SW caches non-verified bytes; integrity check is downstream
**File**: `public/sw.js:60-95`, `src/app/providers/model-provider.tsx:202-241`
**What**: Service Worker writes the network response to cache (`cache.put`, line 89) before any integrity check. The SHA-256 verification lives in `model-provider.tsx` and runs after `fetchModelBuffer` returns. If a CDN/HF serves a corrupted file once, the SW caches it; on the next request the cache returns the corrupted bytes, the provider integrity-checks, fails, calls `bustSwCache`, then refetches. This works for transient corruption but the cache is briefly authoritative for tampered bytes.
**Why it matters**: A user navigating between pages during the brief window could be served corrupted model bytes from SW cache. Eventual consistency is correct but the recovery loop is non-trivial.
**Fix**: Either (a) attach `?v=<sha256-short>` to the model URL so the cache key changes when the expected hash changes (preferred), or (b) move integrity verification into the SW itself before `cache.put` (more invasive). For the current sprint, (a) is a one-line change in `model-config.ts` once `VITE_MODEL_SHA256` is populated.

### S-3 LOW — Spaces response shape narrowing too permissive
**File**: `src/features/inference/fallback-spaces.ts:123-131`
**What**: `json.data[1]` is accessed before checking that `json.data` is an array. If the Spaces server (or an attacker spoofing it) returns `{}` or a non-object, the code throws a `TypeError` at the indexer rather than the typed `SpacesFallbackError`.
**Why it matters**: The error reaches `useInference.lastError` without an `ErrorCode`, breaking the documented error contract.
**Fix**: Guard with `if (!Array.isArray(json.data) || json.data.length < 2) throw new SpacesFallbackError("Unexpected Spaces response shape.", "RUNTIME");` before accessing `json.data[1]`.

### S-4 LOW — SW error response leaks raw error string
**File**: `public/sw.js:84`
**What**: `new Response(\`Network error: ${err}\`, ...)` concatenates the raw error message into the response body. Content-type isn't set, defaults can be sniffed.
**Why it matters**: Minimal real impact — these are model asset requests, not rendered HTML. But poor hygiene; if a future caller renders this body it becomes an XSS vector.
**Fix**: `new Response(JSON.stringify({ error: "network_error" }), { status: 503, headers: { "content-type": "application/json" } });`

---

## Performance

### P-1 MEDIUM — Vite auto-bundles 26 MB threaded WASM that will never run
**File**: `vite.config.ts`, build output `dist/assets/ort-wasm-simd-threaded.jsep-*.wasm` (26,239 kB)
**What**: `onnxruntime-web` imports trigger Vite's automatic asset linking, which pulls in `ort-wasm-simd-threaded.jsep.wasm` regardless of our `ort.env.wasm.numThreads = 1` and `simd = true` settings. The static-copy plugin correctly copies `ort-wasm.wasm` and `ort-wasm-simd.wasm` to `dist/ort/`, but the threaded variant comes along as a bundled asset.
**Why it matters**: 26 MB extra payload on first deploy load, even though GitHub Pages has no COOP/COEP and cannot use the threaded variant.
**Fix**: Add to `vite.config.ts`:
```ts
build: {
  rollupOptions: {
    external: [/ort-wasm-simd-threaded(\.jsep)?\.(wasm|mjs)$/],
  },
},
```
Verify with `ls -lh dist/assets/*.wasm` after rebuild.

### P-2 MEDIUM — Model download peak memory ~2× file size
**File**: `src/app/providers/model-provider.tsx:126-148`
**What**: The streaming reader pushes each chunk to an array, then allocates a fresh `Uint8Array(loaded)` and copies. Peak memory = (sum of all chunks held in array) + (final combined buffer) ≈ 2× model size. For a 44 MB FP16 ONNX, that's ~88 MB momentarily.
**Why it matters**: On mobile (which we already warn about) the GC pressure during model load can stutter the UI. Not critical on desktop.
**Fix**: Pre-allocate the buffer when `content-length` is known and write directly:
```ts
const buf = total > 0 ? new Uint8Array(total) : null;
let offset = 0;
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  if (value !== undefined) {
    if (buf !== null) {
      buf.set(value, offset);
    } else {
      chunks.push(value); // fallback path when content-length missing
    }
    offset += value.byteLength;
    onProgress(offset, total > 0 ? total : offset);
  }
}
return { buf: buf?.buffer ?? concatChunks(chunks).buffer, source };
```

### P-3 LOW — `inference-service.ts` holds two copies of input tensor briefly
**File**: `src/features/inference/inference-service.ts:138-146`
**What**: `letterboxToTensor` returns a `Float32Array`; that buffer is then wrapped in `new ort.Tensor("float32", lb.tensor, ...)`. ORT may copy on construction (especially for WebGPU EP). Peak ~10 MB for 640×640×3×4 doubled.
**Why it matters**: Borderline. Acceptable; mention only because mobile.
**Fix**: Pass the buffer directly with no further references — current code is fine; flag for future Worker migration.

### P-4 LOW — Bundle main chunk ~893 kB
**File**: build output `dist/assets/index-*.js`
**What**: The main React bundle is ~893 kB / 273 kB gzip. Vite warning at 500 kB threshold.
**Why it matters**: First-paint cost on slow networks.
**Fix**: Split out `onnxruntime-web/ort.bundle.min` (already lazy via dynamic import — verify), and consider `manualChunks` for `dexie`, `recharts`. Track in tech-debt; not blocking.

---

## Accessibility (WCAG 2.1 AA)

### A-1 MEDIUM — No focus management on Detect page state transitions
**File**: `src/pages/detect/detect-page.tsx`
**What**: When `pageState` transitions `upload → loading-model → processing → results` (or to `error`), focus is not moved to the new content region. Keyboard users have to Tab from the previous focused element.
**Why it matters**: Screen-reader users may miss state changes; keyboard users lose context.
**Fix**: Add a `ref` on each state's primary container (e.g., the result section), call `.focus()` in a `useEffect` watching `pageState`. Container needs `tabIndex={-1}` to receive programmatic focus.

### A-2 LOW — 4 pre-existing `useFocusableInteractive` warnings on `role="progressbar"`
**File**: `src/widgets/detection-result-panel/detection-result-panel.tsx:129`, `src/widgets/defect-distribution-chart/defect-distribution-chart.tsx:110`
**What**: Bar elements with `role="progressbar"` are not focusable (`tabIndex` missing).
**Why it matters**: Screen readers may still announce via aria-valuenow + aria-label, but keyboard navigation skips them. Per WCAG, progressbar role should be reachable when it conveys distinct information.
**Fix**: Add `tabIndex={0}` to the progressbar div (and ensure `:focus` outline is visible). Pre-existing pattern but inside the review surface; defer to QA follow-up if not blocking.

### A-3 LOW — Spaces fallback button announces only loading text
**File**: `src/pages/detect/detect-page.tsx:540-545`
**What**: When the button text swaps to "Trying Spaces..." during loading, screen readers may not announce the change unless wrapped in `aria-live`.
**Why it matters**: Users won't know the long-running operation started.
**Fix**: Wrap the dynamic label in a `<span aria-live="polite">{loadingText}</span>`, or add `aria-busy={spacesRunning}` to the button.

---

## Code Quality

### C-1 MEDIUM — ErrorCode coercion via type-cast is brittle
**File**: `src/app/providers/model-provider.tsx:286`
**What**: `const code: ErrorCode = (err as { code?: ErrorCode }).code ?? "NETWORK"` defaults to `NETWORK` for any error without a `code` property. A SyntaxError parsing the response body, a real `TypeError`, or an out-of-memory error all map to `NETWORK`.
**Why it matters**: Error reporting becomes misleading; user sees "Couldn't reach the model server" for a parser bug.
**Fix**: Map by error class first; only fall through to `NETWORK` for `TypeError` / `fetch` failures:
```ts
function inferErrorCode(err: unknown): ErrorCode {
  if (err instanceof TypeError) return "NETWORK";
  if (err instanceof Error) {
    const code = (err as { code?: ErrorCode }).code;
    if (code !== undefined) return code;
  }
  return "RUNTIME"; // generic
}
```

### C-2 LOW — Singleton `serviceInstance` doesn't track session identity
**File**: `src/features/inference/inference-service.ts:69-71`
**What**: `getInferenceService` returns the cached instance when `backend` matches, regardless of whether the underlying `InferenceSession` reference is the same. Today this is safe because `clearInferenceService()` is called from `model-provider.retry()`. But the contract isn't self-enforced.
**Why it matters**: Future code that swaps sessions without calling clear will silently keep using the stale session.
**Fix**: Track session identity in the singleton; invalidate when session changes:
```ts
let cachedSession: InferenceSession | null = null;
// ...
if (serviceInstance !== null && cachedSession === session && serviceInstance.backend === backend) {
  return serviceInstance;
}
cachedSession = session;
```

### C-3 LOW — `clearInferenceService` doesn't reset the warming layout
**File**: `src/features/inference/inference-service.ts:79-81`
**What**: Calling `clearInferenceService()` sets `serviceInstance = null` but the next `getInferenceService` does a full warming run. Good — but if the same session is re-passed (which `model-provider` does NOT today but might in hot-paths), the warming run repeats unnecessarily.
**Why it matters**: Minor — adds ~50-200ms per recreate. Caught by C-2 fix.
**Fix**: Subsumed by C-2.

### C-4 LOW — Dev-mode integrity skip warning fires every load
**File**: `src/app/providers/model-provider.tsx:196-200`
**What**: `console.warn` fires on every `loadModel` call when `sha256` is blank, including retries. Quickly fills the console during development.
**Why it matters**: Developer ergonomics only.
**Fix**: Use a module-scope `let warnedAboutSha = false` guard so the warning fires once per session.

### C-5 LOW — `image-dropzone` validation surface unreviewed
**File**: `src/widgets/image-dropzone/` (not in Sprint A+B but consumed)
**What**: Sprint A+B didn't touch the dropzone but it now feeds real inference rather than mock. Need to verify it rejects non-image types and very large files (>10 MB) before invoking `useInference.run`.
**Why it matters**: A user uploading a 50 MB BMP could crash `createImageBitmap` or fill GPU memory.
**Fix**: Outside this sprint's scope — add to QA pre-launch checklist for Sprint C/D, verify accept attribute is `image/jpeg,image/png,image/webp` and file size guard exists.

---

## Cross-cutting Observations (not findings)

- `model-status-pill.tsx` correctly uses `aria-live="polite"` ✓
- ORT runtime imports are confined to `lib/onnx/ort-loader.ts` and `inference-service.ts`; everywhere else uses `import type` ✓ (D-F honored)
- `numThreads = 1` set in `ort-loader.ts` ✓
- D13 preserved (no Web Workers) ✓
- SW host whitelist matches C8' (self + huggingface.co) ✓
- `useInference` properly aborts previous run when a new run starts ✓ (use-inference.ts:85)
- Dashboard subscribes via `useModelStatus` and does NOT call `ensureReady()` ✓ (D-G honored)
- `clearObjectURL` called on file change in detect-page ✓

---

## Verdict

```
VERDICT: PASS_WITH_FOLLOWUPS
- CRITICAL: 0
- HIGH:     1   (S-1 bbox format — must fix before Spaces fallback ships)
- MEDIUM:   4   (S-2 SW cache integrity, P-1 26MB wasm, P-2 download memory, A-1 focus mgmt, C-1 error code mapping — count 5; calling 4 because P-2 borderline)
- LOW:      8   (S-3, S-4, P-3, P-4, A-2, A-3, C-2, C-3, C-4, C-5 — count 10; some pre-existing; effectively 8 new debt items)
```

**Pre-launch blockers**: S-1 (HIGH). Spaces fallback is unusable without this fix.

**Should fix this sprint**: S-2, P-1, A-1, C-1.

**Backlog**: the LOW items; bundle to tech-debt tracker.

**Re-spawn target**: frontend-engineer should fix S-1 (5-line change) plus the four MEDIUM items in a single follow-up. Estimated effort: 30 min.
