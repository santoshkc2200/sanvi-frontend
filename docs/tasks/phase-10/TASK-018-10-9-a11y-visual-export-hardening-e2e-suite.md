# TASK-018: 10.9 A11y, visual, export hardening & e2e consolidation

**Phase:** 10
**Status:** todo
**Requirement(s):** NFR-1002, NFR-1004, NFR-1005, NFR-1006, NFR-1008
**Depends on:** TASK-013, TASK-015, TASK-017
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-018 (platform health, privacy provider, release)
**Slice:** 10.9 — Privacy integration, hardening & release
**Release:** `v0.11.0` · **Flags:** default on at the end of this task

## Context

The sweep that makes the phase safe to leave running: one e2e suite covering the whole journey, an
accessibility and visual pass across every shipped theme and both locales, export hardening, and the
bundle assertions that prove nothing credential-shaped or PII-shaped escaped.

Backend TASK-018 tags `v0.11.0`; it cannot do so until this task is `done`.

## What to do

- [ ] **E2E consolidation** — one suite covering the phase journey against a mocked backend, plus a
      sandbox smoke test: connect (mocked OAuth) → create campaign → publish → see it in the list →
      pause → see the change log; drift shows a diff and does not auto-overwrite; diagnostics shows a
      consent-suppressed conversion with the correct reason; a budget threshold fires and auto-pause
      behaves as described.
- [ ] **a11y sweep** — charts have text alternatives and accessible data tables; colour is never the
      only encoding for status, drift, or threshold state; the campaign builder is fully keyboard
      operable including the stepper and the creative uploader; diagnostics tables are screen-reader
      coherent.
- [ ] **Visual sweep** — dashboard, builder, diagnostics, and placement previews across every shipped
      theme and both locales, including Japanese number and currency formatting **inside charts** and
      CJK line breaking in previews.
- [ ] **Export hardening** — permission-gated, no PII beyond what the tenant already holds, no blended
      ROAS column, and streamed rather than buffered for long ranges.
- [ ] **Bundle assertions** — no OAuth client secret or developer token in any build output; the
      dashboard route stays lazy-loaded; the chart layer is within the performance budget; the storefront
      bundle grew only by the beacon.
- [ ] **Degraded mode** — when a platform is unreachable, the affected screens say **which platform** and
      what is stale, rather than surfacing a generic error everywhere.
- [ ] **Release readiness** — confirm every phase-10 frontend acceptance criterion below, then hand off
      to backend TASK-018 for the tag.

## Acceptance criteria

- [ ] The consolidated e2e suite passes against the mocked backend and the sandbox smoke path.
- [ ] axe passes on every phase-10 surface; the full journey is keyboard operable end to end; no status,
      drift, or threshold state is colour-only.
- [ ] Visual snapshots pass across every shipped theme and both locales, including JPY formatting inside
      charts and CJK line breaking in placement previews.
- [ ] The export is permission-gated, streams for a long range, and contains no blended ROAS column and
      no raw customer data (grep-asserted).
- [ ] `node scripts/check-no-secret-keys-in-bundle.mjs` passes over a real build with the ad-platform
      patterns included.
- [ ] `pnpm check:budget` passes: the dashboard route is lazy-loaded, the chart layer is within budget,
      and the storefront bundle's growth is attributable to the beacon alone.
- [ ] With a platform unreachable, each affected screen names the platform and what is stale, and
      recovers without a reload once it returns.
- [ ] The phase's frontend acceptance criteria are all checked: connect both platforms and see a campaign
      live; both attribution sources labelled with a methodology explanation available; restatement
      visibly flagged; diagnostics correctly explain a consent-suppressed and an opt-out-suppressed
      conversion naming purpose and source; a natively changed campaign appears as drift with an explicit
      resolution choice; budget threshold alerts fire and auto-pause behaves exactly as described.
- [ ] `pnpm check:all` is green.

## Verification

```bash
pnpm install
pnpm generate:api
pnpm check:all
pnpm test:e2e
node scripts/check-no-secret-keys-in-bundle.mjs
```

## Out of scope

Phase 11's cross-cutting performance, accessibility audit, and GA hardening — this task closes phase
10's own surface only.

## Files likely touched

- `apps/admin/e2e/**` (consolidated phase-10 suite), `apps/storefront/e2e/**`
- visual snapshot fixtures across themes and locales
- `packages/ui/src/charts/**` (a11y fixes surfaced by the sweep)
- export path in `apps/admin/src/routes/advertising/Dashboard.svelte`
- `packages/i18n` catalogs (`en`, `ja`) — degraded-mode messaging
- `scripts/check-no-secret-keys-in-bundle.mjs`, CI workflow

## Notes / gotchas

- Phase-level rollback order is the backend's, and the UI must match it: with `advertising.dashboard`
  off the numbers go dark while ingestion continues; with `advertising.budget_guardrails` off every
  tenant holding a cap is notified. **Campaigns live on the platforms keep spending throughout any
  rollback**, and every disabled screen must say so rather than implying advertising has stopped.
- Do not treat the a11y sweep as a fix-list at the end. Anything found here that should have failed in
  an earlier task's axe check is also a gap in that task's tests.
- `v0.11.0` is tagged by backend TASK-018 only once this task is `done`.

---
*On completion: satisfy every acceptance criterion, run the verification commands,
then record status with the sdlc-planner script (never by hand-editing this line
and the backlog separately):*
`sdlc.py status TASK-018 done --note "<PR or commit>"`
