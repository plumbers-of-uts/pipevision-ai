# Design 001 — Browser Inference Finalization

**Date:** 2026-05-15
**Doc:** `docs/plans/designs/001-browser-inference-finalization.md`
**Predecessor:** `plan-pipevision-extension` (D1–D15 보존)

## 목적

Detect 페이지의 `runMockInference()` 스텁 제거 → HF Hub의 FP16 ONNX 모델을 브라우저에서 직접 추론. 단일 InferenceService 싱글톤 + 5-phase ModelProvider 상태머신 + SW 모델 캐시 + Spaces 폴백 버튼.

## 접근 (Approach B — structural)

```
src/features/inference/   # 코어 (service, runtime-select, pre/post/nms, fallback, hook)
src/lib/onnx/             # ORT 로더 + SW 등록
src/app/providers/model-provider.tsx (REWRITE)
public/sw.js (NEW)
```

페이지 표면: `useModelStatus()` + `useInference()` 두 개만.

## 핵심 결정 (Δ from base plan)

- **D-A** 출력 텐서 layout 자동 감지 (nc-first / nc-last)
- **D-B** Warming run을 출력 계약 검증과 통합 (0.5 fill 더미)
- **D-C** 무결성 SHA-256 (MD5 폐기)
- **D-D** SW 호스트 화이트리스트 (self + huggingface.co)
- **D-E** numThreads=1, proxy=false, simd wasm 명시 (GH Pages COOP/COEP 불가)
- **D-F** ORT Tensor는 `import type`만, 경계는 Float32Array
- **D-G** Dashboard는 구독만, ensureReady() 트리거는 Detect에서만
- **D-H** Spaces 폴백은 사용자 트리거 버튼
- **D-I** 결과 패널에 mAP=0.44 칼리브레이션 문구
- **D-J** commit-sha URL 핀은 Sprint 6 defer

D1–D15는 모두 유지. D13(Web Worker는 Sprint 6) 보존을 위해 inference-service 경계 명확화.

## 변경 파일 (~16–18개)

NEW: features/inference/* (×9, 테스트 2 포함), lib/onnx/* (×2), widgets/model-status-pill, public/sw.js, .env.example, e2e/detect.spec.ts
REWRITE: app/providers/model-provider.tsx
EDIT: pages/detect/detect-page.tsx, pages/dashboard/dashboard-page.tsx, widgets/app-sidebar/app-sidebar.tsx, main.tsx, vite.config.ts, package.json, index.html (CSP), .github/workflows/deploy.yml, README.md

## Blind Review 결의 (Tier 1)

A1·A2(출력 텐서 계약 자동 감지+검증), B1(Tensor 타입 격리), C1(SHA-256), C2(SW 화이트리스트), D1(wasm 경로 명시), E1(vitest 단위 + Playwright E2E 1개) — 모두 설계에 반영됨.

## Out of Scope (Sprint 6+)

모바일 분기 강제, Spaces 동의 모달, commit-sha 핀, visual regression, 결과 출처 배지, Web Worker, INT8, prefetch, i18n, telemetry.

## Open Questions

1. HF 모델 실제 URL + SHA-256 (사용자가 .env로 제공 필요)
2. Spaces URL + Gradio 응답 스키마 검증
3. YOLO26 출력 layout (자동 감지로 흡수 가능, export 시점 정보 있으면 단축)

## Next

`/plan` 워크플로로 분해 → 우선순위 P0 9개 작업 후보 (provider, pre/post/nms+테스트, service+hook, detect 결선, SW+SHA, sidebar/dashboard, Spaces, CSP+deploy, E2E).
