# 001 — Browser Inference Finalization

**Session:** pipevision-browser-inference  
**Date:** 2026-05-15  
**Status:** Design approved — ready for `/plan` decomposition  
**Predecessor:** `docs/plans/pipevision-extension-design.md` (Sprints 1–7 plan)

---

## TL;DR

FlowBust의 Detect 페이지에 박혀 있는 `runMockInference()` 스텁(1.5s + 랜덤 bbox)을 제거하고, 이미 HF Hub에 게시된 FP16 ONNX 모델을 브라우저에서 직접 실행하도록 결선한다. 단일 `InferenceService` 싱글톤 + `ModelProvider` 5-phase 상태머신 + Service Worker 모델 캐시 + HF Spaces 폴백 버튼까지 포함한다. 기존 플랜의 D1–D15 결정과 모두 정합한다.

---

## 1. Scope

**범위 (must-have)**
- 이미지 업로드 → ORT 세션 로드 → 전처리 → 추론 → NMS → bbox 그리기 → IndexedDB 저장 (E2E)
- 5-phase 상태머신: idle → fetching → compiling → warming → ready / error
- 사이드바 / Detect 배너 / Dashboard StatCard 3곳에서 로딩 UX 표시 (D10)
- Service Worker로 모델 파일 + ORT WASM 자산 cache-first (D11)
- HF Spaces Gradio 폴백 버튼 (자동 폴백 아님, 사용자 트리거) (D5)
- 최소 회귀: vitest 단위 + Playwright E2E 1개

**범위 밖 (defer to Sprint 6)**
- 모바일 분기 정책 강제(현재 코드상 안내 문구만)
- Spaces 폴백 시 사용자 동의 모달
- Service Worker 새 버전 broadcast(skipWaiting + claim 단순화로 갈음)
- ORT Web Worker 분리 (D13 보존)
- HF Hub `resolve/<commit-sha>` 핀, 시각 회귀, 결과 출처 배지

---

## 2. Architecture

```
앱 마운트
  └─ ModelProvider (status: idle)
       └─ Detect 페이지 진입 시 ensureReady() 호출
            ├─ runtime-select(): WebGPU 시도 → WASM SIMD 폴백
            ├─ fetching: ort-loader.dynamicImport('onnxruntime-web') + fetch(modelUrl)
            │             ↑ Service Worker가 cache-first로 가로챔
            │             ↑ SHA-256 무결성 검증
            ├─ compiling: InferenceSession.create(buf, {executionProviders})
            └─ warming: 더미 0.5 텐서 1회 run (셰이더 컴파일 캐시 + 출력 계약 검증)
       → status: ready { source, backend }

Run Detection 클릭
  └─ useInference().runWithFallback(image)
       ├─ preprocess: ImageBitmap → letterbox 640 → Float32Array
       ├─ session.run
       ├─ postprocess: 텐서 layout 자동 감지 → DecodedBox[]
       ├─ nms (class-wise, iou=0.45, conf=0.25, maxDet=100)
       ├─ unletterbox: 원본 픽셀 좌표 복원
       └─ Detection[] 반환 → detect-page가 캔버스 + IndexedDB

실패 시
  └─ phase: error { code, retryable }
       └─ Detect 배너에 "Try Hugging Face Spaces fallback" 버튼 노출
            └─ runSpacesFallback() → 동일 Detection[] 형태로 흡수
```

### 모듈 트리

```
src/
├── app/providers/
│   └── model-provider.tsx            [REWRITE]
├── features/inference/                [NEW]
│   ├── inference-service.ts
│   ├── runtime-select.ts
│   ├── preprocess.ts
│   ├── postprocess.ts
│   ├── nms.ts
│   ├── fallback-spaces.ts
│   ├── model-config.ts
│   ├── use-inference.ts
│   ├── types.ts
│   └── __tests__/
│       ├── nms.test.ts
│       └── postprocess.test.ts
├── lib/onnx/                          [NEW]
│   ├── ort-loader.ts
│   └── sw-register.ts
├── widgets/model-status-pill/         [NEW]
├── pages/detect/detect-page.tsx       [EDIT]
├── pages/dashboard/dashboard-page.tsx [EDIT]
├── widgets/app-sidebar/app-sidebar.tsx[EDIT]
└── main.tsx                           [EDIT]
public/sw.js                           [NEW]
.env.example                           [NEW]
vite.config.ts                         [EDIT]
package.json                           [EDIT]
e2e/detect.spec.ts                     [NEW]
README.md                              [EDIT]
```

총 약 16–18개 파일.

---

## 3. Key Interfaces

### 3.1 ModelStatus 상태머신

```ts
export type ModelStatus =
  | { phase: "idle" }
  | { phase: "fetching"; loaded: number; total: number }
  | { phase: "compiling" }
  | { phase: "warming" }
  | { phase: "ready"; source: "network" | "cache"; backend: "webgpu" | "wasm" }
  | { phase: "error"; reason: string; retryable: boolean; code: ErrorCode };

export type ErrorCode =
  | "NETWORK" | "INTEGRITY" | "UNSUPPORTED" | "SESSION_CREATE" | "RUNTIME";

interface ModelContextValue {
  status: ModelStatus;
  ensureReady: () => Promise<void>;
  retry: (opts?: { bustCache?: boolean }) => Promise<void>;
  session: () => InferenceSession | null;
}
```

### 3.2 InferenceService

```ts
export interface InferenceInput {
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | Blob | File;
  originalWidth?: number;
  originalHeight?: number;
}

export interface InferenceRawDetection {
  classId: number;
  score: number;
  bbox: { x: number; y: number; w: number; h: number };  // 원본 픽셀 좌표
}

export interface InferenceService {
  run(input: InferenceInput, opts?: { signal?: AbortSignal }): Promise<{
    detections: InferenceRawDetection[];
    inferenceMs: number;
    totalMs: number;
    backend: "webgpu" | "wasm";
  }>;
}
```

### 3.3 useInference 훅

```ts
export interface UseInferenceResult {
  run: (input: InferenceInput) => Promise<Detection[]>;
  runWithFallback: (input: InferenceInput) => Promise<{
    detections: Detection[];
    source: "local" | "spaces";
  }>;
  isRunning: boolean;
  lastError: { code: ErrorCode; message: string } | null;
}
```

`InferenceRawDetection[]` → `Detection[]` 매핑 시 `id=uuidv4`, `className/severity/color`는 `PIPEVISION_CLASSES` lookup.

### 3.4 출력 텐서 계약 (자동 감지)

```ts
export interface OutputContract {
  layout: "nc-first" | "nc-last";        // [1, 4+nc, N] | [1, N, 4+nc]
  numClasses: 7;
  outputActivation: "sigmoid" | "none";  // 기본 sigmoid
  boxFormat: "xywh-center";              // YOLO 표준
}
```
첫 warming run의 `outputs[0].dims`로 layout 결정, dtype은 float32 강제. 불일치 시 `error { code: UNSUPPORTED }`.

### 3.5 Service Worker 계약

```js
const MODEL_CACHE = "pv-model-v1";
const ALLOWED_HOSTS = new Set([self.location.origin, "https://huggingface.co"]);
const ASSET_PATTERNS = [/\.onnx(\?|$)/, /ort-wasm.*\.wasm(\?|$)/];
// install: skipWaiting
// activate: clients.claim + 옛 캐시 삭제
// fetch: 호스트 화이트리스트 통과한 ASSET 요청만 cache-first
```

캐시 무효화 키: `?v=<sha256-short>` 쿼리.

### 3.6 환경 변수

```bash
# 필수
VITE_MODEL_URL=https://huggingface.co/<HF_USER>/pipevision-yolo26m/resolve/main/yolo26m-fp16.onnx
VITE_MODEL_SHA256=<64 hex>
# 선택
VITE_SPACES_URL=https://<hf-user>-pipevision.hf.space
```

`SHA-256`은 클라이언트에서 `crypto.subtle.digest`로 검증.

### 3.7 ORT 로더 설정

```ts
ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
ort.env.wasm.numThreads = 1;      // GitHub Pages는 COOP/COEP 불가
ort.env.wasm.simd = true;
ort.env.wasm.proxy = false;
```

`type { Tensor, InferenceSession }`만 정적 import, 런타임 import는 `dynamic import('onnxruntime-web')`.

---

## 4. Integration Points

### 4.1 `src/app/providers/model-provider.tsx` (REWRITE)
- `useReducer` 5-phase 전이
- 모듈 스코프 `sessionRef` (HMR 안전, 재마운트 무관)
- `ensureReady()` 동시 호출 시 동일 promise 반환
- `retry({ bustCache })` 에러 복구

### 4.2 `src/widgets/app-sidebar/app-sidebar.tsx` (D10 #1)
- 정적 “Demo Mode” pill → `<ModelStatusPill status={useModelStatus()} />`
- phase별 색상 + `aria-live="polite"`

### 4.3 `src/pages/detect/detect-page.tsx` (D10 #2)
- `runMockInference()` 제거 (38–77줄)
- `PageState`에 `"loading-model"`, `"error"` 추가
- `IMG_W/IMG_H` 하드코딩 → ImageBitmap에서 동적
- 모델 로딩 중에도 sample 선택 가능 (F1 해결): 다운로드 중 “Use sample image while loading” 가시화
- 결과 패널에 “Demo accuracy: mAP@0.5 = 0.44 — may miss subtle defects” 한 줄 추가 (F2)

### 4.4 `src/pages/dashboard/dashboard-page.tsx` (D10 #3)
- StatCard “Browser WASM inference” → 동적 텍스트 (구독만, ensureReady 호출 X — B2)

### 4.5 `vite.config.ts`
```ts
import { viteStaticCopy } from "vite-plugin-static-copy";
plugins: [react(), tailwindcss(), viteStaticCopy({
  targets: [
    { src: "node_modules/onnxruntime-web/dist/ort-wasm.wasm", dest: "ort/" },
    { src: "node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm", dest: "ort/" },
  ],
})],
optimizeDeps: { exclude: ["onnxruntime-web"] }
```

### 4.6 `src/main.tsx`
```ts
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
```

### 4.7 `index.html` CSP meta (C3)
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  connect-src 'self' https://huggingface.co https://*.hf.space;
  img-src 'self' data: blob:;
  style-src 'self' 'unsafe-inline';
">
```

### 4.8 `.github/workflows/deploy.yml` (D2)
GitHub Actions에 secrets/vars 주입:
- `VITE_MODEL_URL`, `VITE_MODEL_SHA256`, `VITE_SPACES_URL`

### 4.9 `package.json` 의존성
```jsonc
"dependencies": { "onnxruntime-web": "^1.20.0" },
"devDependencies": {
  "vite-plugin-static-copy": "^2.x",
  "vitest": "^2.x",
  "@playwright/test": "^1.x"
}
```

---

## 5. Edge Cases & Error Handling

| 카테고리 | 케이스 | 동작 |
|---|---|---|
| 백엔드 | WebGPU 미지원 | WASM SIMD 폴백, status.backend='wasm' |
| 백엔드 | SIMD까지 미지원 | error UNSUPPORTED, Spaces 폴백만 노출 |
| 백엔드 | SharedArrayBuffer 없음 (GH Pages) | numThreads=1 강제, 정상 동작 |
| 네트워크 | 모델 fetch 타임아웃 30s | NETWORK 에러, retry 가능 |
| 네트워크 | SHA-256 불일치 | INTEGRITY 에러, 캐시 무효화 후 1회 재시도 |
| 네트워크 | HF Hub CORS | NETWORK 에러 + Spaces 폴백 안내 |
| 캐시 | 두 번째 방문 | source='cache', fetching phase 건너뜀 |
| 이미지 | 4K+ | createImageBitmap resizeWidth=1280로 다운샘플 |
| 이미지 | HEIC | 드롭존 단에서 거부 |
| 이미지 | EXIF 회전 | imageOrientation:'from-image' 자동 보정 |
| 이미지 | 흑백 1채널 | RGB로 복제 |
| 추론 | session.run throws | WASM 1회 폴백 재시도 → 그래도 실패면 RUNTIME |
| 추론 | NaN/Inf | postprocess가 필터링, 0개로 처리 |
| 추론 | 0개 detection | 정상, “No defects detected” UI |
| 추론 | 동시 호출 | isRunning 가드, 두 번째 무시 |
| 추론 | 페이지 이동 | AbortController 취소, 저장 스킵 |
| 폴백 | Spaces cold start | 60s 타임아웃, “Waking up server…” |
| 폴백 | URL 미설정 | 버튼 자체 비노출 |
| UX | prefers-reduced-motion | 스피너 정지, 텍스트만 |
| UX | 모바일 ≤768px | 안내 문구 (D3, 코드 분기는 Sprint 6) |

### 에러 메시지 카탈로그

| code | UI 텍스트 | 액션 |
|---|---|---|
| NETWORK | "Couldn't reach the model server." | Retry · Spaces fallback |
| INTEGRITY | "Model file appears corrupted; refreshing cache…" | (자동 1회 시도) |
| UNSUPPORTED | "This browser doesn't support local inference." | Spaces fallback |
| SESSION_CREATE | "Couldn't initialize the model. Trying fallback runtime…" | (자동 폴백) |
| RUNTIME | "Inference failed on this image." | Retry · Spaces fallback |

---

## 6. Test Strategy

### 6.1 단위 (vitest)
- `nms.test.ts`: 알려진 박스셋 → 기대 출력 (overlap 케이스, 다중 클래스, maxDet 컷)
- `postprocess.test.ts`: 합성 텐서로 layout 자동 감지 + xywh→xyxy 변환 검증
- `preprocess.test.ts`: letterbox scale/pad 계산 (640×640 입력, 가로/세로 긴 이미지 양쪽)

### 6.2 E2E (Playwright)
- `e2e/detect.spec.ts`:
  1. 앱 로드
  2. Detect 페이지 이동
  3. 샘플 이미지 클릭
  4. Run Detection
  5. status='ready' 도달 + 1개 이상 bbox + IndexedDB 레코드 존재

CI: `mise run test` → `vitest run && playwright test --project=chromium`

### 6.3 회귀 sanity
3장의 라벨된 샘플(이미 `SAMPLE_CATALOG`에 존재)로 클래스/개수 sanity. 모델 정확도 자체 회귀는 Python `model/verify.py`가 export 시점에 책임지므로 프론트엔드는 “돌긴 도는가” 수준만 보장.

---

## 7. Decision Log (Δ from base plan)

| 결정 | 내용 |
|---|---|
| **D-A** | 출력 텐서 layout 자동 감지 (`nc-first` / `nc-last`) — YOLO26 출력 스키마 불확실성 흡수 |
| **D-B** | Warming run을 출력 계약 검증 단계와 통합 (0.5 fill 더미) |
| **D-C** | 무결성 해시는 **SHA-256** (MD5 불채택) |
| **D-D** | Service Worker 호스트 화이트리스트: self origin + huggingface.co만 |
| **D-E** | ORT `numThreads=1`, `proxy=false`, simd wasm 명시 (GH Pages COOP/COEP 불가) |
| **D-F** | InferenceService 경계는 Float32Array, ORT `Tensor` 타입은 `import type`만 |
| **D-G** | Dashboard 모델 상태는 **구독만**, ensureReady() 트리거는 Detect 페이지에서만 |
| **D-H** | Spaces 폴백은 **사용자 트리거 버튼** (자동 폴백 X — 결과 출처 명확성) |
| **D-I** | mAP=0.44 칼리브레이션 문구를 결과 패널에 1줄 노출 |
| **D-J** | 모델 URL 핀 정책은 운영 가이드(README)로 (commit-sha 핀은 Sprint 6) |

기존 D1–D15는 모두 유지. 특히 D13(Web Worker는 Sprint 6) 보존을 위해 `inference-service.ts` 경계만 명확히 유지.

---

## 8. Out of Scope (Sprint 6+로 명시 defer)

- 모바일 디바이스 강제 분기 (samples-only UX)
- Spaces 폴백 사용자 동의 모달 (C4)
- HF Hub `resolve/<commit-sha>` 핀 (D4)
- Visual regression / Storybook (E3)
- 결과 출처 배지 (local vs spaces, F3)
- Web Worker 분리 (D13 — 프로파일링 후 결정)
- INT8 quantization, Background prefetch on Dashboard, i18n, 익명 telemetry

---

## 9. Open Questions

1. **HF Hub의 모델 정확한 URL과 SHA-256?** — 사용자가 이미 게시했다고 했으나 실제 값 필요. `.env.example`에 placeholder, 실제 값은 GitHub Actions secrets로.
2. **Spaces 폴백 URL** — 게시되어 있는지, Gradio API 응답 스키마는 섹션 2-5 가정과 일치하는지 확인 필요.
3. **YOLO26 출력 layout** — 자동 감지로 흡수 가능하지만, export 시점에 알려져 있으면 model-config에 박아서 검증 단계 단축 가능.

---

## 10. Next Step

Run `/plan` to decompose this design into actionable tasks. 우선순위 후보:
1. ModelProvider 상태머신 + ort-loader (P0)
2. preprocess/postprocess/nms + 단위 테스트 (P0)
3. inference-service + use-inference (P0)
4. detect-page 결선 + 모델 로딩 UI (P0)
5. Service Worker + SHA-256 검증 (P1)
6. 사이드바/대시보드 상태 표시 (P1)
7. Spaces 폴백 + 에러 핸들링 (P1)
8. CSP meta + deploy.yml secrets (P2)
9. Playwright E2E (P2)
