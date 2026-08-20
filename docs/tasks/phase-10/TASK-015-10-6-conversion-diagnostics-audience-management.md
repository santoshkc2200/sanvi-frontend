# TASK-015: 10.6 Conversion diagnostics & audience management

**Phase:** 10
**Status:** todo
**Requirement(s):** FR-1009, NFR-1008
**Depends on:** TASK-014
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-015 (upload state, diagnostics projection, audiences)
**Slice:** 10.6 — Conversion upload, dedupe & diagnostics
**Prerelease:** `v0.11.0-alpha.7` · **Flag:** `advertising.conversion_tracking`

## Context

The screen that turns "the numbers look wrong" into a specific, fixable cause — and, just as
importantly, separates the causes a tenant can fix from the ones they must respect.

The single most consequential design decision here is the reason taxonomy. "40 % of your conversions
were suppressed by opt-outs" and "40 % failed to upload" are different conversations. One is a working
privacy system; the other is an incident. They must never share a banner, a colour, or a sentence.

## What to do

- [ ] **Contract** — `GET /ads/conversions` with upload columns (per-platform state, attempt count, last
      error, dedupe outcome, suppression reason), `GET /ads/conversions/{id}/diagnostics` (the full
      per-event story), `POST /ads/conversions/{id}/retry`, `GET/POST /ads/audiences`,
      `POST /ads/audiences/{id}/refresh`.
- [ ] **Diagnostics view** — the recent-conversions table with per-platform upload status, dedupe
      status, and suppression reason, filterable by outcome. Each row expands to the full story:
      captured at, click ids present/absent, value source, directive snapshot, and each platform's
      attempt history with the platform's own error text.
- [ ] **Reason taxonomy in plain language** — every suppression and failure maps to a sentence saying
      what happened and what, if anything, the tenant can do. The categories are distinct on purpose:
      *missing consent*, *opted out of sale/share*, *browser privacy signal*, *withdrawn after capture*,
      *missing click id*, *upload error*, *token expired*. **The first four are not problems to fix.**
- [ ] **Health banner** — appears when the upload failure ratio or the suppression share crosses a
      threshold, **with the split between consent-absent and opted-out shown separately**.
- [ ] **Audience management** — list, build, refresh, and a plain statement that opted-out subjects are
      removed on refresh and cannot be re-added.
- [ ] **Retry affordance** — visible only on genuinely retryable rows. A retry button on a
      directive-suppressed event is a compliance trap; it does not render.

## Acceptance criteria

- [ ] Every taxonomy category renders its own message — asserted **exhaustively over the enum**, so a
      new backend category cannot fall through to a generic string.
- [ ] A consent-suppressed and an opt-out-suppressed conversion each display the purpose **and** the
      signal source that decided them.
- [ ] The health banner shows suppression share and upload failure ratio as separate figures with
      separate copy; neither is expressed by colour alone.
- [ ] A partial success (Google uploaded, Meta failed) renders both platform states independently, never
      as a single status.
- [ ] The retry control does not render on directive-suppressed rows and does render on parked ones.
- [ ] The audience screen states the opt-out removal rule before any build or refresh action.
- [ ] No raw customer data appears anywhere in the view or its export — identifiers render as hashes.
- [ ] axe passes on the diagnostics table, the expanded row, and the audience screens; the table is
      screen-reader coherent with the expansion announced.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:i18n
pnpm check:tokens
pnpm check:boundaries
pnpm test:e2e --filter admin
```

## Out of scope

Dashboard metrics and charts (TASK-016), budget alerts (TASK-017), and the phase-wide export hardening
sweep (TASK-018).

## Files likely touched

- `apps/admin/src/routes/advertising/{Diagnostics,Audiences}.svelte`
- `packages/ui/src/advertising/{HealthBanner,ReasonBadge}.svelte`
- `packages/api-client/src/advertising.ts`
- `packages/i18n` catalogs (`en`, `ja`) — the full reason taxonomy
- admin e2e specs

## Notes / gotchas

- Rollback: `advertising.conversion_tracking` off → the workers stop and the queue holds; captured
  events are retained. The view should show the paused state rather than an empty table that reads as
  "nothing happened".
- Write the taxonomy copy with a privacy reviewer, not as placeholder strings to polish later. These
  sentences are what a tenant quotes back to their own customers.
- Exhaustive enum coverage is a test, not a code review item — a new category must fail the build.

---
*On completion: satisfy every acceptance criterion, run the verification commands,
then record status with the sdlc-planner script (never by hand-editing this line
and the backlog separately):*
`sdlc.py status TASK-015 done --note "<PR or commit>"`
