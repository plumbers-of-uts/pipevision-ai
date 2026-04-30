# Sprint 2 Frontend Bootstrap — Progress

**Started:** 2026-04-30
**Status:** IN PROGRESS

## Tasks
- [x] Read all reference docs (DESIGN.md, gui-mockup.html, plan JSON, design doc)
- [ ] T2.2 — Vite + React 19 + bun + TypeScript
- [ ] T2.3 — Tailwind CSS v4 + shadcn/ui + design tokens
- [ ] T2.4 — biome + commitlint + lefthook + mise tasks
- [ ] T2.5 — HashRouter + 4 route shells
- [ ] T2.6 — widgets/app-sidebar
- [ ] T2.7 — app/app.tsx layout shell + providers
- [ ] T2.8 — GitHub Actions deploy workflow

## Key Decisions
- Tailwind v4 (CSS-first config via @tailwindcss/vite) — DESIGN.md Appendix B provides oklch tokens for v4
- lefthook over husky (lighter, no Node bootstrap)
- React 19 createRoot API
- HashRouter for GitHub Pages compatibility

## Notes
- DESIGN.md Appendix B has Tailwind v4 CSS @theme block ready
- gui-mockup.html lines 644-665 show sidebar structure (4 nav items, logo, footer)
- shadcn/ui to be configured with CSS variables for design token integration
