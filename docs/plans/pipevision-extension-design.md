# PipeVision Extension Design

**Project:** Plumbing Defect Detection & Pipe Inspection System #37
**Team:** Plumbers of UTS (Bo Zhao, Jadyn Braganza, Eunkwang Shin)
**Phase:** Prototype extension (initial experiment → public demo)
**Authors:** Eunkwang Shin (with `/oma-brainstorm`)
**Status:** Approved (ready for `/plan`)
**Date:** 2026-04-30

---

## 1. Context

### 1.1 초기 실험 요약 (출처: Initial Experimental Results PDF)

- **Task**: Object Detection — Sewer pipe defect (7 classes)
- **Model**: YOLO26m, 21.8M params, FP32 PyTorch checkpoint (`best.pt`)
- **Dataset**: Roboflow Sewage Defect Detection (980 images, 70/20/10 split)
- **Hardware**: Tesla T4 (Colab/SageMaker)
- **결과**: mAP@0.5 = 0.44, mAP@0.5:0.95 = 0.198 (best ckpt = epoch 57)
- **클래스별 편차**: Utility intrusion (0.708) > Obstacle (0.668) > … > Joint offset (0.196)
- **데이터셋 long-tail**: 22.5:1 (Crack 696 vs Hole 31)

### 1.2 현재 프로토타입 상태

- `DESIGN.md` — 풀 디자인 시스템 (HSL 토큰, severity scale, 타이포그래피)
- `gui-mockup.html` — 4페이지 정적 mockup (`dashboard`, `detect`, `history`, `models`) + sidebar 어드민 레이아웃
- 실제 구현 코드/패키지 없음. 학습된 `best.pt`는 AWS SageMaker에 위치.

### 1.3 확장 목적

- **Use case**: A (UTS 과제 데모) + D (포트폴리오 공개 데모)
- **제약**: 0 인프라 운영, 0 비용, 24/7 가용, 데스크톱 우선
- **인터랙션 수준**: C (방문자 업로드 → 실시간 추론)

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. 학습된 YOLO26m 모델을 누구나 브라우저에서 즉시 추론 가능하게 한다 (이미지 업로드 → bbox + confidence + class label 시각화)
2. 0 운영 부담 / 0 비용 / 24/7 가용 — 정적 호스팅만 사용
3. 데스크톱 우선 (WebGPU 활용), 모바일은 "샘플 클릭" 모드로 graceful degrade
4. 학습 결과 페이지에 PDF의 메트릭/차트를 정직하게 표기
5. 변환 실패 시 안전망: HF Spaces (Gradio + 원본 `.pt`) 병행 운영

### 2.2 Non-Goals

- 비디오 / 실시간 카메라 스트림
- 사용자 계정 · 클라우드 저장 · DB
- 재학습 트리거 · 라벨링 도구
- 모바일 풀 추론 (samples-only fallback)
- 다국어 (영어만)
- 인증 · rate limit
- INT8 양자화 (FP16만)
- 모델 prefetch (Future Work)

---

## 3. Tech Stack

| 레이어 | 선택 | 비고 |
|--------|------|------|
| Build | Vite + React 19 + TypeScript | 정적 SPA |
| Runtime/PM | bun (1.1+) | mise 통해 실행 |
| Styling | Tailwind CSS + CSS variables | DESIGN.md 토큰 포팅 |
| UI primitives | shadcn/ui | React 19 호환 컴포넌트만 |
| Inference | onnxruntime-web | WebGPU EP → WASM SIMD fallback |
| Local storage | Dexie (IndexedDB wrapper) | History 페이지용 |
| Charts | recharts | per-class mAP, training curve |
| Hosting (코드) | GitHub Pages (HashRouter) | GitHub Actions 자동 배포 |
| Hosting (모델) | Hugging Face Hub | CORS 친화, 무료 무제한 |
| Fallback (서버) | Hugging Face Spaces (Gradio) | 변환 실패 보험 + 학술 비교 |
| Caching | Service Worker (cache-first for model) | 재방문 ~1s ready |
| Lint/Format | biome | bun 친화 |
| Tooling | mise + commitlint | CLAUDE.md dev-workflow 준수 |

---

## 4. High-Level Architecture

```
┌─────────────────────────────────────────────┐
│ AWS SageMaker (학습/저장 — 일회성)            │
│   best.pt → S3: s3://.../model.tar.gz       │
└──────────────────┬──────────────────────────┘
                   │ aws s3 cp (one-time)
                   ▼
┌─────────────────────────────────────────────┐
│ Local: 모델 변환 파이프라인                   │
│   pt → ONNX FP16 → ORT optimize → verify    │
└──────────────────┬──────────────────────────┘
                   │ huggingface-cli upload
                   ▼
┌─────────────────────────────────────────────┐
│ Hugging Face Hub                            │
│   <user>/pipevision-yolo26m                 │
│   ├─ model.onnx (~44MB)                     │
│   ├─ metadata.yaml                          │
│   └─ README.md (model card)                 │
└──────────────────┬──────────────────────────┘
                   │ static fetch (CORS-friendly)
                   ▼
┌─────────────────────────────────────────────┐
│ User Browser                                │
│   onnxruntime-web                           │
│   ├─ EP: WebGPU → WASM SIMD fallback        │
│   ├─ preprocess (letterbox 640×640)         │
│   ├─ inference                              │
│   ├─ postprocess (NMS in TS)                │
│   └─ canvas overlay (bbox + label)          │
│   Service Worker: cache-first for model     │
└─────────────────────────────────────────────┘
                   ▲
                   │
┌─────────────────────────────────────────────┐
│ GitHub Pages (코드 호스팅)                   │
│   Vite 빌드 산출물 (HashRouter SPA)          │
└─────────────────────────────────────────────┘

병행 운영 (Fallback):
┌─────────────────────────────────────────────┐
│ Hugging Face Spaces                         │
│   Gradio + ultralytics .pt                  │
│   메인 사이트 footer에 토글로 노출            │
└─────────────────────────────────────────────┘
```

---

## 5. 모델 변환 파이프라인

### 5.1 디렉토리 (변환 워크스페이스)

```
model/
├─ download.sh           # SageMaker S3 → 로컬
├─ export.py             # .pt → ONNX FP16 + ORT optimize
├─ verify.py             # PT vs ONNX mAP 비교 (회귀 테스트)
├─ upload.sh             # HF Hub push
├─ metadata.yaml         # 클래스, 임계값, 메트릭
├─ README.md             # HF Hub model card
├─ requirements.txt      # ultralytics, onnxruntime-tools, huggingface-hub
└─ artifacts/            # gitignored (.pt, .onnx)
```

### 5.2 핵심 export 설정

```python
model.export(
    format="onnx",
    half=True,           # FP16 (mAP 손실 거의 0, 사이즈 ~44MB)
    dynamic=False,       # 고정 입력 shape (640×640) — WebGPU 친화
    simplify=True,       # onnx-simplifier
    imgsz=640,
    opset=17,            # ORT Web 호환 (>=14)
    nms=False,           # NMS는 클라이언트에서 처리
)
```

**`nms=False` 이유**: (a) export 안정성 (b) WebGPU 비효율 (c) 임계값 슬라이더로 사용자 조정 가능.

### 5.3 검증 기준

`model/verify.py`에서 valid set 196장에 대해 PT vs ONNX 추론을 비교. 허용 차이 `|Δ mAP@0.5| < 0.005`.

### 5.4 metadata.yaml

```yaml
model:
  name: yolo26m-pipevision-fp16
  format: onnx
  input_shape: [1, 3, 640, 640]
  precision: fp16
  opset: 17
  size_mb: 44
classes:
  - { id: 0, name: Buckling, severity: high }
  - { id: 1, name: Crack, severity: medium }
  - { id: 2, name: Debris, severity: low }
  - { id: 3, name: Hole, severity: critical }
  - { id: 4, name: Joint offset, severity: medium }
  - { id: 5, name: Obstacle, severity: high }
  - { id: 6, name: Utility intrusion, severity: high }
inference:
  conf_threshold: 0.25
  iou_threshold: 0.45
  max_detections: 100
metrics:
  mAP_0.5: 0.44
  mAP_0.5_0.95: 0.198
```

### 5.5 자동화 수준

CI에서 자동 변환 안 함. `mise run model:export`/`model:verify`/`model:upload` 로컬 task만 등록.

---

## 6. Frontend

### 6.1 라우팅 (mockup의 4 페이지 그대로)

| 경로 | 페이지 | 역할 |
|------|--------|------|
| `/#/` | Dashboard | "이번 세션 통계" + Recent Detections (IndexedDB 기반) |
| `/#/detect` | Detect | 메인 추론 UI |
| `/#/history` | History | IndexedDB 로컬 저장 + 페이지네이션 + CSV export |
| `/#/models` | Models | PDF의 mAP 표 + training curve + Future Work 6항목 |

라우터: `react-router-dom@7` HashRouter.

### 6.2 디렉토리 구조 (FSD-lite, **kebab-case 강제**)

```
src/
├─ app/
│  ├─ app.tsx
│  ├─ providers/
│  │  ├─ model-provider.tsx
│  │  └─ theme-provider.tsx
│  ├─ register-sw.ts
│  └─ routes.tsx
├─ pages/
│  ├─ dashboard/
│  ├─ detect/
│  ├─ history/
│  └─ models/
├─ widgets/
│  ├─ app-sidebar/
│  ├─ stat-card/
│  ├─ recent-detections/
│  ├─ defect-distribution-chart/
│  ├─ image-dropzone/
│  ├─ detection-canvas/
│  ├─ detection-result-panel/
│  ├─ class-legend/
│  ├─ confidence-slider/
│  ├─ history-table/
│  ├─ history-filter-bar/
│  ├─ metrics-table/
│  ├─ per-class-chart/
│  ├─ training-curve-chart/
│  ├─ future-work-cards/
│  ├─ model-status-pill/
│  └─ model-loader-banner/
├─ features/
│  ├─ inference/
│  │  ├─ runtime.ts
│  │  ├─ preprocess.ts
│  │  ├─ postprocess.ts
│  │  ├─ progress-tracker.ts
│  │  ├─ types.ts
│  │  └─ workers/
│  │     └─ inference-worker.ts        # 측정 후 도입
│  ├─ history-store/
│  │  ├─ db.ts
│  │  ├─ repository.ts
│  │  └─ types.ts
│  ├─ samples/
│  │  ├─ catalog.ts
│  │  └─ assets/
│  └─ export/
│     └─ csv-exporter.ts
├─ shared/
│  ├─ ui/                              # shadcn/ui (kebab-case)
│  ├─ lib/
│  │  ├─ webgpu.ts
│  │  ├─ device.ts
│  │  └─ class-color.ts
│  └─ config/
│     └─ env.ts
└─ main.tsx
```

**네이밍 규칙**:
- 파일/폴더명: kebab-case
- 컴포넌트 export 이름: PascalCase
- types: `types.ts` 또는 `*.types.ts`

### 6.3 IndexedDB 스키마 (`features/history-store/db.ts`)

```typescript
interface HistoryRecord {
  id: string;                  // uuid
  createdAt: number;           // epoch ms
  imageBlob: Blob;             // 원본 이미지 (jpeg)
  thumbnailDataUrl: string;    // 250×250 미리보기
  detections: Detection[];
  inferenceMs: number;
  modelVersion: string;
  notes?: string;
}
// 인덱스: createdAt, modelVersion, detections.class
```

사용자가 언제든 "Clear History" 가능. 개인정보는 사용자 디바이스에만.

### 6.4 mockup 가짜 통계 → 실데이터 매핑

| mockup card | 실제 데이터 |
|-------------|------------|
| Total Inspections | IndexedDB count |
| Defects Found | detection이 1개 이상인 record count |
| Detection Accuracy | **PDF의 mAP@0.5 = 0.44 (정직 표기)** |
| Avg Processing Time | history.inferenceMs 평균 |
| Model Status (신규) | "Ready · 44 MB · WebGPU" 등 |

### 6.5 mockup → React 컴포넌트 매핑

| mockup 영역 | 컴포넌트 |
|-------------|---------|
| `.sidebar` + `.nav-item` | `app-sidebar` |
| `.stat-card` × 4~5 | `stat-card` (variant prop) |
| Recent Detections | `recent-detections` |
| Defect Distribution | `defect-distribution-chart` |
| Detect dropzone + preview | `image-dropzone` + `detection-canvas` |
| Image Guidelines / Supported Defects | `detect-sidebar` |
| History grid + pagination | `history-table` + `history-filter-bar` |
| Models chart-svg | `training-curve-chart` (recharts) |

---

## 7. 추론 파이프라인 + 모델 로딩 UX

### 7.1 추론 모듈

- **runtime.ts**: ONNX 세션 lazy init (WebGPU 1순위, WASM SIMD fallback)
- **preprocess.ts**: HTMLImageElement → Float16Array (1, 3, 640, 640) + letterbox + scale/pad 반환
- **postprocess.ts**: raw output → Detection[] (confidence 필터링 → NMS → 좌표 복원)
- **inference-worker.ts**: 메인 스레드 60fps 떨어지면 Worker로 이전 (측정 후 결정)

### 7.2 NMS (TypeScript)

```typescript
function nms(boxes: Box[], iouThreshold: number): Box[] {
  boxes.sort((a, b) => b.confidence - a.confidence);
  const kept: Box[] = [];
  for (const box of boxes) {
    if (kept.every(k => iou(k, box) < iouThreshold)) kept.push(box);
  }
  return kept;
}
```

### 7.3 모델 로딩 상태 모델

```typescript
type ModelStatus =
  | { phase: 'idle' }
  | { phase: 'fetching'; loaded: number; total: number }
  | { phase: 'compiling' }
  | { phase: 'warming' }
  | { phase: 'ready'; source: 'network' | 'cache' }
  | { phase: 'error'; reason: string; retryable: boolean };
```

상태 전이: `idle → fetching → compiling → warming → ready` (또는 SW cache hit 시 `idle → compiling → ready`).

### 7.4 다운로드 진행률 fetch

`onnxruntime-web`의 `InferenceSession.create`는 진행률 미노출. 직접 `fetch + ReadableStream` 으로 ArrayBuffer 받아 ORT에 전달.

### 7.5 UI 분산 표시 (3곳)

| 위치 | 컴포넌트 | 동작 |
|------|---------|------|
| Sidebar 하단 (항상) | `model-status-pill` | gray/amber/green/red dot + 짧은 라벨 |
| `/detect` dropzone 위 | `model-loader-banner` | 다운로드 % 진행률 + remaining time, ready 시 자동 unmount |
| Dashboard stat card | `stat-card` (variant=model-status) | mockup 4번째 stat 옆 또는 교체 |

### 7.6 Service Worker

- 모델 ONNX URL 매칭 시 cache-first 전략
- 앱 코드: stale-while-revalidate (Vite 해시 자동 무효화)
- ~30줄 자체 작성, workbox 미사용

### 7.7 Prefetch — Future Work로 미룸

Dashboard 진입 시 자동 prefetch는 도입 안 함. 사용자가 `/detect` 진입 시점부터 fetch.

### 7.8 에러 복구 UX

| 에러 | UI | 자동 복구 |
|------|-----|----------|
| 네트워크 실패 | "Retry" 버튼 + 지수 백오프 1회 자동 | 자동 |
| HF Hub 404 | "Server-side demo로 이동" → HF Space | — |
| WebGPU 컴파일 에러 | WASM EP로 자동 fallback | 자동 |
| OOM | "Sample mode로 전환" 안내 | 사용자 선택 |

### 7.9 모바일 / WebGPU 분기

```typescript
const mode =
  isMobile() ? 'samples-only' :
  !hasWebGPU() ? 'wasm-degraded' :
  'full';
```

- `samples-only`: 업로드 숨김, 미리 추론된 결과 갤러리
- `wasm-degraded`: 동작은 하되 "느림" 안내 배너

### 7.10 GitHub Pages 배포

- `vite.config.ts`의 `base: '/pipevision-ai/'`
- `HashRouter` 사용 (가장 안전)
- GitHub Actions: `bun install && bun run build && deploy-pages@v4`

---

## 8. HF Spaces Fallback

```
huggingface.co/spaces/<user>/pipevision-yolo26m
├─ app.py            # Gradio 인터페이스 (~40줄)
├─ requirements.txt
├─ best.pt
└─ README.md         # YAML metadata
```

메인 사이트 footer에 "Server-side demo (slower)" 링크 노출 → 학술 비교 가치.

---

## 9. Risks & Mitigations

| ID | 리스크 | 확률/영향 | 미티게이션 |
|----|--------|----------|-----------|
| R1 | YOLO26m ONNX export 실패 | 중/치명 | M2에서 우선 시도. 실패 시 yolo26s 변형 → HF Spaces 메인 전환 |
| R2 | mAP 회귀 (>1%) | 낮/중 | verify.py 자동 검증, 실패 시 FP32 다운그레이드 |
| R3 | WebGPU 미지원 (Safari 일부) | 중/낮 | WASM SIMD 자동 fallback |
| R4 | 모델 첫 로드 시간 길어 이탈 | 중/중 | 진행률 UI + Service Worker 캐시 |
| R5 | HF Hub CORS / rate limit | 낮/중 | GitHub Releases 자산 폴백 + SW 캐시 |
| R6 | gh-pages 단일 파일 100MB 한도 | 낮/낮 | 모델은 HF Hub라 영향 없음 |
| R7 | 데드라인 미달성 | 중/치명 | M2 후 HF Spaces로 항상 데모 가능 상태 유지 |
| R8 | Crack/Joint offset 낮은 mAP 노출 | 확정/낮 | Future Work 6항목으로 학술적 신뢰감 ↑ |
| R9 | 변환 환경 차이 | 낮/낮 | mise + requirements.txt 핀 |
| R10 | SageMaker .pt 추출 어려움 | 낮/중 | M1 첫날 시도 |

---

## 10. Roadmap (M1~M5, 약 7~10일)

### M1 — 모델 추출 + 변환 검증 (1~2일) ⚠️ 가장 큰 리스크
- SageMaker `best.pt` → 로컬 다운로드
- ONNX FP16 export
- mAP 회귀 < 1% 검증
- HF Hub model repo 첫 push
- **Gate**: export 성공 + 회귀 < 1%. 실패 시 R1 fallback

### M2 — HF Spaces fallback + 프로젝트 셋업 (1일)
- HF Spaces Gradio 앱 push (안전망 즉시 가용)
- Vite + React 19 + bun + TS 초기화
- DESIGN.md 토큰 → CSS var + Tailwind theme
- shadcn/ui, biome, mise.toml task 등록
- GitHub Actions 워크플로우 골격
- **Gate**: `bun run dev` 빈 라우터 + sidebar 셸 동작

### M3 — Detect 페이지 + 추론 모듈 + 모델 로딩 UX (3일) — 핵심 가치
- `features/inference/` (runtime/preprocess/postprocess/progress-tracker)
- `model-provider`, `model-status-pill`, `model-loader-banner`
- Service Worker 등록 (cache-first for model)
- `image-dropzone`, `detection-canvas`, `detection-result-panel`, `confidence-slider`, `class-legend`
- 6~10장 샘플 카탈로그
- 모바일 분기 (`samples-only`)
- WebGPU 미지원 분기 (`wasm-degraded`)
- **Gate**: 노트북에서 업로드 → bbox 시각화 < 3s (warmup 후)

### M4 — Dashboard / History / Models (2일)
- `features/history-store/` (Dexie)
- `pages/dashboard/` + stat-card (Model Status 포함) + recent-detections + defect-distribution-chart
- `pages/history/` + history-table + history-filter-bar + CSV export
- `pages/models/` + metrics-table + per-class-chart + training-curve-chart + future-work-cards
- **Gate**: 4페이지 모두 mockup과 시각적 일치 + IndexedDB 라운드트립 동작

### M5 — 다듬기 + 배포 (1~2일)
- 정직한 메트릭 표기 점검 (Detection Accuracy = mAP 0.44)
- 접근성 (WCAG AA, focus, keyboard)
- 첫 로드 사이즈 측정 + 코드 스플리팅
- GitHub Pages 배포
- HF Space와 메인 사이트 상호 링크
- README 업데이트
- **Gate**: Lighthouse Perf ≥ 85, Accessibility ≥ 95

---

## 11. 검증 시나리오

| 시나리오 | 통과 조건 |
|----------|----------|
| 신규 방문자 (cold start) | LCP < 5s, 모델 진행률 표시, 15s 내 첫 추론 가능 |
| 재방문 (SW cache hit) | 1s 내 추론 가능 |
| 이미지 업로드 → 결과 | 데스크톱 WebGPU < 3s, severity 색상 정합 |
| 모바일 방문 | samples-only 안내, 샘플 클릭 시 즉시 결과 |
| History 50건 누적 | 페이지네이션/필터/CSV export 정상, 메모리 < 500MB |
| WebGPU 미지원 | WASM 모드 안내 + 추론 정상 (~5s) |
| HF Spaces 링크 | 외부 탭에서 동일 모델 추론 가능 |

---

## 12. 학술적 가치 강화 (`/models` 페이지)

1. YOLO26 아키텍처 다이어그램 (PDF Figure 1)
2. 클래스 분포 (long-tail 22.5:1 명시)
3. Test vs Validation 표 (PDF 그대로)
4. **Future Work 카드 6장** — Data Aug / Class Imbalance / Attention / Multi-scale / Extended Training / Faster R-CNN 비교 (각 카드 "Status: Planned")
5. 라이브 추론 메트릭 — 사용자 추론 시간 평균 (history.inferenceMs)

---

## 13. Out-of-Scope / Future Work

- 비디오 / 실시간 카메라
- 재학습 / 라벨링
- 다국어
- 인증 / 클라우드 history
- INT8 양자화 / 모바일 풀 추론
- 텔레메트리 백엔드
- **모델 prefetch** (M3에서 제외, 추후 도입 가능)
- Web Worker 분리 (성능 측정 후 결정)

---

## 14. 결정 이력 (Decision Log)

| # | 결정 | 이유 |
|---|------|------|
| D1 | 사용 시나리오: A + D | 무료 + 24/7 + 누구나 접근 |
| D2 | 인터랙션: C (업로드 추론) + 0 인프라 | 사용자 명시 |
| D3 | 디바이스: 데스크톱 우선 (a) | WebGPU 활용, 모바일은 samples 모드 |
| D4 | Frontend: Vite + React 19 + bun (i 신규 프로젝트) | mockup은 디자인 레퍼런스, 새로 작성 |
| D5 | Hosting: GitHub Pages (코드) + HF Hub (모델) | 100MB 제한 우회 + CORS 친화 |
| D6 | 양자화: FP16 | mAP 무손실 + 사이즈 절반 |
| D7 | NMS: 클라이언트 TypeScript | export 안정성 + 임계값 슬라이더 |
| D8 | History: IndexedDB (Dexie) | 0 인프라 유지하면서 mockup 시연 가치 보존 |
| D9 | Detection Accuracy 표기: 정직하게 mAP 0.44 | 포트폴리오 신뢰도 |
| D10 | Model loading UI: 3곳 분산 | sidebar pill + detect banner + dashboard stat |
| D11 | Service Worker 캐싱 도입 | 재방문 1s ready |
| D12 | Prefetch: Future Work | M3 단순화 |
| D13 | Web Worker: 측정 후 결정 | 메인 스레드 우선 시도 |
| D14 | Router: HashRouter | GitHub Pages 안전 |
| D15 | 파일/폴더명: kebab-case | 사용자 명시 규칙 |

---

## 15. Next Step

`/plan` 워크플로우로 넘어가 위 14개 섹션을 task 단위로 분해.
