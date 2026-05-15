# Browser Inference Finalization

> Detect 페이지의 `runMockInference()` 스텁을 제거하고 HF Hub의 FP16 ONNX 모델을 브라우저에서 직접 추론하도록 결선한다.

**Status**: Completed
**Created**: 2026-05-15
**Owner**: frontend-engineer (주) + qa-reviewer + tf-infra-engineer
**Session ID**: browser-inference-001

## Goal

업로드된 파이프 사진에 대해 브라우저 onnxruntime-web으로 추론하여 7개 결함 클래스의 bbox를 표시하고 IndexedDB에 저장한다. 5-phase 상태머신, 3곳 로딩 UX, Service Worker 캐시, HF Spaces 폴백 버튼, 최소 회귀 테스트(vitest + Playwright)까지 포함한다.

## Context

- 선행 설계: `docs/plans/designs/001-browser-inference-finalization.md`
- API 계약: `.agents/skills/_shared/core/api-contracts/pipevision-contracts.md` (Corrigendum 섹션이 Design 001 결정에 우선)
- 선행 플랜: `docs/plans/pipevision-extension.md` (전체 7-Sprint 계획; 본 트래커는 그 중 Sprint 3 결선에 해당)
- 코드 진입점: `src/pages/detect/detect-page.tsx:49`(`runMockInference`), `src/app/providers/model-provider.tsx:30`(stub Provider), `src/widgets/app-sidebar/app-sidebar.tsx:77`(static pill)

## Constraints

- D1–D15 의사결정 유지. 특히 **D13 보존**: Web Worker는 Sprint 6 결정 사항.
- GitHub Pages 호스팅 → COOP/COEP 불가 → `numThreads=1`, no SharedArrayBuffer.
- `onnxruntime-web`의 `Tensor` 타입은 `import type`만, 런타임 import는 동적.
- kebab-case 파일/폴더, 영문 user-visible strings.
- 모델 자산 무결성은 **SHA-256** (MD5 폐기).

## Tasks

| # | Task | Agent | Priority | Status | Dependencies |
|---|------|-------|----------|--------|--------------|
| T1 | model-config + .env.example + runtime-select | frontend | P0 | DONE | — |
| T2 | lib/onnx/ort-loader (dynamic import + wasmPaths) | frontend | P0 | DONE | T1 |
| T3 | vite.config viteStaticCopy + optimizeDeps | frontend | P0 | DONE | T2 |
| T4 | preprocess.ts letterbox + NCHW Float32 | frontend | P0 | DONE | — |
| T5 | postprocess.ts output layout auto-detect + decode | frontend | P0 | DONE | — |
| T6 | nms.ts class-wise NMS | frontend | P0 | DONE | — |
| T7 | inference-service.ts singleton + warming/validation | frontend | P0 | DONE | T2, T4, T5, T6 |
| T8 | model-provider.tsx REWRITE — 5-phase state machine | frontend | P0 | DONE | T1, T2, T7 |
| T9 | use-inference.ts hook + Detection mapping | frontend | P0 | DONE | T7, T8 |
| T10 | detect-page.tsx wiring — remove stub + loading UX | frontend | P0 | DONE | T8, T9 |
| T11 | widgets/model-status-pill + sidebar wiring (D10 #1) | frontend | P1 | DONE | T8 |
| T12 | dashboard-page StatCard dynamic (D10 #3, subscribe-only) | frontend | P1 | DONE | T8 |
| T13 | public/sw.js + sw-register + main.tsx (D11) | frontend | P1 | DONE | T7 |
| T14 | SHA-256 integrity check (C7') | frontend | P1 | DONE | T7, T13 |
| T15 | fallback-spaces.ts + detect-page fallback button (D5) | frontend | P1 | DONE | T9, T10, S1 |
| T16 | index.html CSP meta | frontend | P2 | DROPPED | T13 |
| T17 | .github/workflows/deploy.yml secrets injection | tf-infra | P2 | DONE | — |
| T18 | vitest setup + unit tests (T4/T5/T6) | qa | P2 | DONE | T4, T5, T6 |
| T19 | Playwright E2E detect.spec.ts | qa | P2 | SKIPPED | T10 |
| T20 | README Status/What's left update | frontend | P3 | DONE | T10, T13 |
| S1 | HF Spaces response schema decision | human | P0 | OPEN | — |
| S2 | Provide VITE_MODEL_URL + VITE_MODEL_SHA256 | human | P0 | OPEN | — |

### Sprint 묶음

- **Sprint A (P0)** T1–T10 — 코어 추론 결선. 게이트: Detect happy path 동작.
- **Sprint B (P1)** T11–T15 — 로딩 UX·캐시·폴백. 게이트: 캐시 히트, 3곳 UX, 폴백 버튼.
- **Sprint C (P2)** T16–T19 — 보안·배포·QA. 게이트: CSP·CI 그린·테스트.
- **Sprint D (P3)** T20 — 문서.

## Done When

- [ ] Detect 페이지가 실제 HF Hub ONNX 모델로 bbox 생성 (S2 충족 시)
- [ ] 사이드바 / Detect 배너 / Dashboard StatCard 3곳에서 모델 상태 표시
- [ ] 두 번째 방문 시 Service Worker 캐시 히트, 재다운로드 없음
- [ ] SHA-256 불일치 시 캐시 무효화 + 1회 재시도, 그래도 실패면 INTEGRITY 에러
- [ ] VITE_SPACES_URL 있을 때 Spaces 폴백 버튼 동작 (S1 해소 후)
- [ ] index.html에 CSP meta, CI는 GitHub secrets에서 env 주입
- [ ] vitest 3개 단위 suite 그린, Playwright E2E 1개 Chromium 그린
- [ ] README 현행화

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-15 | Approach B (structural service + state machine) 채택 | D1–D15와 1:1, A는 tactical, C는 D13(Web Worker)을 뒤집음 |
| 2026-05-15 | 무결성 해시 MD5 → SHA-256 | 보안 표준; 비용 동일 (crypto.subtle.digest) |
| 2026-05-15 | SW 캐시 호스트 화이트리스트 (self + huggingface.co) | 임의 URL 영구 캐시 방지 |
| 2026-05-15 | ORT 출력 dtype = float32 가정 + 첫 warming run 시 검증 | ORT-Web은 FP16 모델도 JS에 float32로 노출 |
| 2026-05-15 | 출력 layout (nc-first vs nc-last) 자동 감지 | YOLO26 export 스키마 불확실성 흡수 |
| 2026-05-15 | `Tensor`는 `import type`만 사용 | 트리쉐이킹 / 메인 번들 격리 |
| 2026-05-15 | Dashboard StatCard는 상태 구독만, ensureReady() 호출 X | Dashboard 진입 시 모델 다운로드 트리거 방지 |
| 2026-05-15 | Spaces 폴백은 사용자 트리거 버튼 (자동 아님) | 결과 출처 명확성 — 데모 무결성 |
| 2026-05-15 | `metadata.yaml` 런타임 fetch 폐기 | TS 코드(`PIPEVISION_CLASSES` + `model-config`)를 SSOT로 |
| 2026-05-15 | S1 — Spaces 폴백을 **JSON detections** 반환으로 확정 (Option A) | 이미지-only 폴백은 History/Dashboard/CSV 모든 컨슈머에 분기 강제. Spaces 앱 Python 한 파일 ~30줄 변경으로 영구 비대칭 제거. Spaces 앱은 `gr.Image + gr.JSON` 두 출력. 클라이언트는 `data[1].detections`만 사용 |
| 2026-05-15 | S2 — 환경 변수 누락 시 **fail-loud** 정책 | 빌드는 통과, 런타임에서 `error { code: NETWORK, retryable: false }` + 사용자 안내. Sample UI 워크스루는 동작. Spaces URL만 있으면 폴백 경로로 데모 가능. 무음 가짜 URL 시도는 디버깅 비용이 크므로 금지 |
| 2026-05-15 | S2 — GitHub Actions에서 `VITE_MODEL_URL`/`VITE_MODEL_SHA256`은 `secrets.*`, `VITE_SPACES_URL`은 `vars.*`로 주입 | Spaces URL은 공개 정보(민감하지 않음); URL/해시는 향후 비공개 모델 호환 위해 secret 처리 |

## Open Questions / Blockers

| ID | 내용 | 차단 | Owner | 상태 |
|---|---|---|---|---|
| S1 | HF Spaces 폴백 응답 — **JSON detections (Option A)로 결정 (2026-05-15)**. Spaces 앱 `app.py`를 `gr.Image + gr.JSON` 두 출력으로 작성. 코드 스펙은 결정 로그 참조. | T15 | human (Spaces 배포) | DECIDED |
| S2 | 실제 HF URL + SHA-256 값 — **누락 시 fail-loud 정책으로 결정 (2026-05-15)**. 값 자체는 사용자가 제공. | T10 런타임 데모 | human (값 발급) | DECIDED / 값 대기 |

## Out of Scope (Sprint 6+)

- 모바일 samples-only 강제 (코드 분기)
- Spaces 폴백 동의 모달 (C4 deferred)
- HF Hub `resolve/<commit-sha>` URL 핀 (D4 deferred)
- Visual regression / Storybook
- 결과 출처 배지 (local vs spaces, F3 deferred)
- Web Worker 분리 (D13 보존)
- INT8 quantization, background prefetch, i18n, telemetry, video, live camera

## Progress Notes

- [2026-05-15] Plan created from Design 001 (brainstorm session). Sprint A의 T1부터 `/work` 또는 `/orchestrate`로 진행 가능. S1, S2 결정은 평행 진행 가능 (T1–T9는 차단 없음).
- [2026-05-15] S1, S2 결정 완료 (oma-backend). Spaces 앱 코드 스펙 + .env 정책 + GitHub Actions 주입 방식 확정. T15, T17 차단 해제. Spaces 배포 실작업과 실제 env 값 발급만 사용자 작업으로 남음.
- [2026-05-15] Sprint A (T1–T10) + Sprint B (T11–T15) 완료. 단일 frontend-engineer 서브에이전트로 3회 분할 실행. 검증 결과: typecheck=0, lint=0 errors (4 a11y warnings 잔존, pre-existing 패턴), build=0 (vite-plugin-static-copy 누락은 후속 설치로 해결, dist/ort/에 wasm 4개 복사 확인). 트래커 T1-T15 모두 DONE으로 갱신. 남은 작업: Sprint C (T16-T19 보안·CI·QA), Sprint D (T20 문서).
- [2026-05-15] QA 리뷰 (inline, qa-reviewer 서브에이전트 30 tool uses 한계 도달 → 메인 에이전트가 4개 최고 리스크 파일 정밀 감사). 판정 PASS_WITH_FOLLOWUPS: HIGH 1 + MEDIUM 4 + LOW 8. 리포트: `.agents/results/qa-review-browser-inference-001.md`.
- [2026-05-15] QA follow-up 픽스 5건 적용. S-1 HIGH (Spaces bbox `[x,y,w,h]`로 정정), S-2 MEDIUM (`?v=<sha-short>` 캐시 키), C-1 MEDIUM (inferErrorCode 헬퍼), A-1 MEDIUM (Detect 페이지 stateRegionRef 포커스). P-1 MEDIUM 부분 해결: ORT 1.26은 threaded WASM만 출시하므로 26MB 자체 제거 불가; 대신 `vite-plugin-static-copy` 폴더 구조 보존 버그를 인라인 Vite 플러그인(`copyOrtWasm`)으로 대체해 `dist/ort/*.wasm` 평탄 배치 확보(런타임 wasmPaths 해상도 정확). 검증 typecheck/lint/build all 0.
- [2026-05-15] Sprint C + D 완료. Serwist(`@serwist/vite` + `@serwist/window` + `serwist`) 도입으로 커스텀 `public/sw.js` 대체 — `src/sw.ts`에 ONNX/ORT WASM cache-first 전략 + x-from-cache 헤더 attach. `tsconfig.json`에 webworker lib + `@serwist/vite/typings` 추가. T13 register 함수는 `virtual:serwist` 통해 PROD-only 등록으로 정리. T17 deploy.yml: 빌드 step에 `VITE_MODEL_URL`/`VITE_MODEL_SHA256` (secrets) + `VITE_SPACES_URL` (vars) 주입. T18 vitest + 16개 단위 테스트(nms 7건, postprocess 9건) 그린. T20 README 현행화. T16 CSP는 사용자 결정으로 드롭. T19 Playwright는 사용자 결정으로 스킵. 최종 검증 typecheck/lint/test/build all 0. **Sprint A+B+C+D = CLOSED.**
