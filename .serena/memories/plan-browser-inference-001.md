# Plan — Browser Inference Finalization

**Session:** browser-inference-001
**Date:** 2026-05-15
**Status:** Active — ready for `/work`

## Artifacts

- Design: `docs/plans/designs/001-browser-inference-finalization.md`
- Plan JSON: `.agents/results/plan-browser-inference-001.json`
- Tracker: `docs/plans/work/001-browser-inference-finalization.md`
- Contracts: `.agents/skills/_shared/core/api-contracts/pipevision-contracts.md` (Corrigendum: C1', C2', C5', C6', C7', C8')

## TL;DR

Detect 페이지의 mock 추론을 실제 onnxruntime-web 추론으로 결선. 20 작업 + 2 human decisions. 복잡도 Complex.

## Sprint 묶음

- **Sprint A (P0, T1–T10)** 코어 추론 결선 — Detect happy path.
- **Sprint B (P1, T11–T15)** 로딩 UX(D10) + SW 캐시(D11) + Spaces 폴백(D5).
- **Sprint C (P2, T16–T19)** 보안(CSP)·배포(secrets)·QA(vitest+Playwright).
- **Sprint D (P3, T20)** 문서.

## Human Blockers

- **S1** Spaces 응답 스키마(JSON detections vs 이미지-only) — T15 차단. 권장: Spaces 앱 수정.
- **S2** 실제 HF URL + SHA-256 — T10 런타임 데모 차단. T1–T9는 차단 없음.

## 의존성 단순화

```
T1 → T2 → T3
T4 ─┐
T5 ─┼→ T7 → T8 → T9 → T10 → T19 (E2E)
T6 ─┘    │     T11, T12 (← T8)
         └→ T13 → T14, T16
T17 (독립)
T18 (← T4/T5/T6)
T20 (← T10/T13)
T15 (← T9/T10/S1)
```

## 인수 기준 요지

- Detect 페이지 실제 bbox 생성
- 3곳 모델 상태 표시
- 캐시 히트 / SHA-256 검증 / Spaces 폴백
- CSP meta / CI secrets / vitest + Playwright 그린
- README 현행화

## 다음 단계

`/work` 실행 시 Sprint A부터 순차 진행. S1/S2 결정은 평행 작업 가능.
