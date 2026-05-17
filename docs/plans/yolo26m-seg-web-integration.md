# Plan — yolo26m-seg Web Integration (pipevision-ai scope)

**Status**: design approved, ready for `/plan`
**Owner**: pipevision-ai repo
**Pair plan**: `cnn-assignment3/docs/plans/yolo26m-seg-unified-model.md`

This plan covers steps 6–12 of the unified-segmentation initiative: take the
HF-hosted `yolo26m-seg` ONNX and wire it through the existing detection-only
web app so the Detect page renders **bbox + class mask** in one inference
call, and History/Dashboard reflect the new data shape.

Steps 1–5 (data + training + export + HF upload) live in the paired plan
inside the cnn-assignment3 repo.

---

## Interface Contract — shared with cnn-assignment3

Both plans MUST agree on this contract; either side can change it only via paired update.

| Item | Value |
|---|---|
| HF model repo | `plumbers-of-uts/pipevision-yolo26m-seg` |
| ONNX file name | `yolo26m-seg-fp16.onnx` |
| Input | `images: float32 [1, 3, 640, 640]`, NCHW, RGB, `0..1`, letterboxed |
| Output 0 — detections | `float32 [1, 4+7+32, N]` (nc-first layout, N≈8400) |
|   bytes 0..3 | cx, cy, w, h in normalised 640-space `[0,1]` |
|   bytes 4..10 | class scores (sigmoid applied) |
|   bytes 11..42 | 32 mask coefficients (no activation) |
| Output 1 — prototypes | `float32 [1, 32, 160, 160]` |
| Mask decode | `mask = sigmoid(prototypes.T @ coefficients).reshape(160, 160)` → threshold 0.5 → crop to bbox → resize to original |
| Class IDs | 0 Buckling, 1 Crack, 2 Debris, 3 Hole, 4 Joint offset, 5 Obstacle, 6 Utility intrusion |
| Inference defaults | conf=0.25, iou=0.45, max_det=100 |
| NMS | not embedded — done in TS client |
| Opset | 17 |
| SHA-256 | published in metadata.yaml after upload |

If any contract field changes, **bump the HF file name** (`-v2`) and update both plans.

---

## Affected modules

```
src/features/inference/
├── model-config.ts          ← add maskChannels, maskRes
├── types.ts                 ← extend Detection (mask), add MaskProtoTensorView
├── postprocess.ts           ← decode 4+nc+nm channels, separate coeffs
├── inference-service.ts     ← consume two outputs, call mask-decoder per surviving box
├── mask-decoder.ts          ← NEW: coeffs @ prototypes → binary mask in bbox space
└── nms.ts                   ← unchanged

src/widgets/detection-canvas/
└── detection-canvas.tsx     ← add semi-transparent mask layer beneath bbox

src/features/history-store/
├── types.ts                 ← Detection.maskPng?: string  (RLE or PNG data URL)
├── repository.ts            ← serialize/deserialize mask
└── db.ts                    ← Dexie schema bump (v2)

model/
├── export.py                ← already handles seg via Ultralytics auto-detect; bump source path
└── metadata.yaml            ← change model.name, add mask metrics
```

---

## Phase 6 — Type Extensions and Model Config

Update `features/inference/model-config.ts`:

```typescript
export interface ModelConfig {
  // ... existing ...
  readonly maskChannels: 32;
  readonly maskRes: 160;
  readonly modelTask: 'detect' | 'segment';
}

export const MODEL_CONFIG: ModelConfig = Object.freeze({
  // ... existing ...
  maskChannels: 32,
  maskRes: 160,
  modelTask: 'segment',
});
```

Update `features/inference/types.ts`:

```typescript
export interface InferenceRawDetection {
  classId: number;
  score: number;
  bbox: { x: number; y: number; w: number; h: number };
  /** Optional binary mask (1 byte per pixel) at bbox resolution; present only for seg task. */
  mask?: Uint8Array;
  /** Width / height of the mask buffer for indexing convenience. */
  maskWidth?: number;
  maskHeight?: number;
}
```

Acceptance:
- TypeScript compile passes.
- No call sites broken (mask is optional).

## Phase 7 — Mask Decoder (NEW)

Create `src/features/inference/mask-decoder.ts`:

```typescript
import type { LetterboxResult } from './preprocess';

export interface PrototypeTensor {
  data: Float32Array;          // length = 32 * 160 * 160
  channels: number;            // 32
  height: number;              // 160
  width: number;               // 160
}

/**
 * Decode one detection's instance mask.
 *
 * @param coeffs       32 floats per detection (from output0 channels 4+nc..end)
 * @param prototypes   [32, 160, 160] flat tensor (output1 view)
 * @param bboxXywh640  bbox in 640-space (cx,cy,w,h, normalised)
 * @param lb           letterbox parameters
 * @param targetW      original image width
 * @param targetH      original image height
 * @returns binary mask sized to the bbox in original image coords
 */
export function decodeMask(
  coeffs: Float32Array,
  prototypes: PrototypeTensor,
  bboxXywh640: { x: number; y: number; w: number; h: number },
  lb: LetterboxResult,
  targetW: number,
  targetH: number,
): { mask: Uint8Array; width: number; height: number };
```

Algorithm:
1. Multiply prototypes by coeffs (32-vector dot product per spatial cell) → `[160,160]` float.
2. Apply sigmoid.
3. Crop to the bbox region (downsample bbox to 160-grid coordinates via scale 160/640).
4. Resize that crop to the bbox in original image space (bilinear).
5. Threshold at 0.5 → Uint8Array (0 or 1 per pixel).

Unit tests (`mask-decoder.test.ts`):
- Synthetic coefficients = all-zero → empty mask.
- Synthetic prototypes = identity-ish → mask should match coefficient pattern.
- Round-trip: bbox at (0,0,640,640) full image case.

## Phase 8 — Postprocess and Inference Service

Update `features/inference/postprocess.ts`:

- `detectLayout` now expects `4 + nc + 32` channels — fix the threshold check.
- `decodeYoloOutput` collects an extra `coeffs: Float32Array(32)` per detection.
- Returned shape: `InferenceRawDetection` with `bbox` normalised + `coeffs` attached temporarily (drop before public boundary).

Add a private intermediate type:

```typescript
interface InferenceRawWithCoeffs extends InferenceRawDetection {
  /** Internal — used to call mask-decoder. Stripped before returning to caller. */
  coeffs: Float32Array;
}
```

Update `features/inference/inference-service.ts`:

- `session.run` returns two outputs; capture both.
- After NMS, for each surviving detection call `decodeMask` and attach the resulting binary mask.
- Add a `decodeMs` field to `InferenceResult` for observability.

Acceptance:
- Warming run still passes (asserts dual output presence in seg mode).
- A real seg ONNX produces non-empty masks on at least one detection in the dev sample image.

## Phase 9 — Canvas Mask Rendering

Update `widgets/detection-canvas/detection-canvas.tsx`:

- New layered draw order: image → masks (alpha 0.4, class color) → bboxes → labels.
- Use an offscreen canvas for each mask: create `ImageData(width, height)` filled with `[r, g, b, 102]` where the mask is 1, transparent where 0.
- `ctx.drawImage(offscreen, det.bbox.x, det.bbox.y)` after scaling.
- Performance: cache decoded mask Image elements when the detection list is stable.

Acceptance:
- Mask overlays appear inside bbox bounds, colored per class.
- Toggling "show masks" checkbox hides/shows the mask layer without re-running inference.

## Phase 10 — History Persistence

Update `features/history-store/types.ts`:

```typescript
export interface Detection {
  // ... existing ...
  /** PNG data URL of the binary mask, scaled to bbox size. Optional for legacy records. */
  maskPng?: string;
}
```

Serialisation in `repository.ts`:
- On insert: convert `Uint8Array + width + height` → 1-bit PNG via OffscreenCanvas, store as data URL.
- On read: lazy decode only when the Detect page reopens the record.

Dexie schema bump (v2):

```typescript
db.version(2).stores({
  records: '++id, createdAt, modelVersion, *detections.classId',
}).upgrade(async tx => {
  // No backfill — old records lose mask field gracefully.
});
```

Acceptance:
- New inspections persist masks; History page shows them when reopened.
- Old records (pre-seg) still load and render bbox-only without crashing.

## Phase 11 — Env, Metadata, Deploy

1. Update `.env.example`:
   ```
   VITE_MODEL_URL=https://huggingface.co/plumbers-of-uts/pipevision-yolo26m-seg/resolve/main/yolo26m-seg-fp16.onnx
   VITE_MODEL_SHA256=<published by cnn-assignment3 plan Phase 5>
   VITE_MODEL_TASK=segment
   ```

2. Update `model/metadata.yaml`:
   - `model.name: yolo26m-seg-pipevision-fp16`
   - `model.input_shape: [1, 3, 640, 640]`
   - `model.outputs: [detections [1,4+nc+32,N], prototypes [1,32,160,160]]`
   - `mask: { channels: 32, resolution: 160 }`
   - `metrics.test.mAP_box_0_5`, `metrics.test.mAP_mask_0_5`.

3. `bun run build` and `bun run lint` clean.

4. Push to `main` → GitHub Pages auto-deploy.

## Phase 12 — Smoke Test and Report Update

- Open the deployed site, drop the same test image used for cnn-assignment3 smoke test, confirm bbox + mask rendered.
- Capture screenshot for `cnn-assignment3/docs/cnn-ass3-PartC-experimental-report.md` `§7 Deployment Artifacts`.
- Add a "Web app" section to the same report linking the deployed URL.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Mask decode is slow in WASM (no SIMD-accelerated matmul) | Cap to top-K detections by score before decoding; benchmark on mid-range laptop |
| ImageData allocation pressure for many masks | Pool reusable offscreen canvases; cap displayed masks to 30 per image |
| Dexie schema migration breaks existing user data | v2 upgrader is a no-op (old detections keep no mask), guarded by version check |
| Mask resolution 160 too coarse for thin Cracks | Visual inspection in Phase 9; if blocky, fall back to FP32 model or upsample with linear interp instead of nearest |
| ONNX dual output not found in warming run | inference-service.ts asserts `session.outputNames.length === 2` and throws UNSUPPORTED with actionable message |

## Definition of done

- [ ] All ten affected modules updated and unit tests passing.
- [ ] `bun run lint` and `bun run typecheck` clean.
- [ ] Live site shows bbox + masks for the canonical test image.
- [ ] History page round-trips a record (save → reload → render mask).
- [ ] Deployed URL recorded in `cnn-assignment3/docs/cnn-ass3-PartC-experimental-report.md`.
