# TASK-015: 10.6 Conversion diagnostics & audience management

**Phase:** 10
**Status:** done
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

- [x] **Contract** — `GET /ads/conversions` with upload columns (per-platform state, attempt count, last
      error, dedupe outcome, suppression reason), `GET /ads/conversions/{id}/diagnostics` (the full
      per-event story), `POST /ads/conversions/{id}/retry`, `GET/POST /ads/audiences`,
      `POST /ads/audiences/{id}/refresh`.
- [x] **Diagnostics view** — the recent-conversions table with per-platform upload status, dedupe
      status, and suppression reason, filterable by outcome. Each row expands to the full story:
      captured at, click ids present/absent, value source, directive snapshot, and each platform's
      attempt history with the platform's own error text.
- [x] **Reason taxonomy in plain language** — every suppression and failure maps to a sentence saying
      what happened and what, if anything, the tenant can do. The categories are distinct on purpose:
      *missing consent*, *opted out of sale/share*, *browser privacy signal*, *withdrawn after capture*,
      *missing click id*, *upload error*, *token expired*. **The first four are not problems to fix.**
- [x] **Health banner** — appears when the upload failure ratio or the suppression share crosses a
      threshold, **with the split between consent-absent and opted-out shown separately**.
- [x] **Audience management** — list, build, refresh, and a plain statement that opted-out subjects are
      removed on refresh and cannot be re-added.
- [x] **Retry affordance** — visible only on genuinely retryable rows. A retry button on a
      directive-suppressed event is a compliance trap; it does not render.

## Acceptance criteria

- [x] Every taxonomy category renders its own message — asserted **exhaustively over the enum**, so a
      new backend category cannot fall through to a generic string.
- [x] A consent-suppressed and an opt-out-suppressed conversion each display the purpose **and** the
      signal source that decided them.
- [x] The health banner shows suppression share and upload failure ratio as separate figures with
      separate copy; neither is expressed by colour alone.
- [x] A partial success (Google uploaded, Meta failed) renders both platform states independently, never
      as a single status.
- [x] The retry control does not render on directive-suppressed rows and does render on parked ones.
- [x] The audience screen states the opt-out removal rule before any build or refresh action.
- [x] No raw customer data appears anywhere in the view or its export — identifiers render as hashes.
- [x] axe passes on the diagnostics table, the expanded row, and the audience screens; the table is
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
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*

## Execution notes (2026-09-10)

**Taxonomy derivation lives in the admin lib, classification never re-derives directives.**
`lib/advertising/diagnostics.ts` maps the wire onto the taxonomy: a capture-time suppression is
classified from the frozen snapshot's `signal_source` (`uoom` → opted out of sale/share, `gpc` →
browser privacy signal, anything else → missing consent); upload-state failure reasons are matched
by the backend's stable vocabulary (`suppressed_late` → withdrawn after capture, click-id mentions →
missing click id, token/credential mentions → token expired) and an unknown reason falls to
`upload_error` — a specific category with its own message, never a generic string. The
compile-time-exhaustive `CATEGORY_COPY: Record<AdReasonCategory, …>` record in the view makes a new
taxonomy category a build error until its copy exists, and the component test walks all seven
categories through the expanded row.

**Dedupe status is rendered as the dedupe *identity*, not an outcome — contract gap recorded.**
The wire carries no per-event dedupe-outcome field (dedupe is storage-level, keyed on
tenant + order_ref/event_id + event name; `ConversionEventView` exposes neither). The expanded row
therefore renders the identity the pipeline deduplicates on — server `event_id` and `order_ref` —
with an explainer. If the backend later projects an outcome (duplicate/canonical), it belongs in
`GET /conversions/{id}/diagnostics` and the row can grow a status cell without redesign.

**Health banner thresholds are frontend presentation constants over the loaded window.** The
backend provides no aggregate endpoint, so `diagnosticsHealth` computes the two figures over the
conversions currently listed (the banner says so). Thresholds: minimum 4 events in the window,
suppression share ≥ 25 % → warning, upload failure ratio ≥ 20 % → error (failures are the incident;
suppressions are the privacy conversation). Directive-decided categories are excluded from the
failure figure by design.

**Retry is a courtesy filter, not the enforcement.** The control renders only for events with a
parked platform state, no denied directive in the frozen snapshot, and a non-`contact` subject key
(an email-identified subject stored nothing this context can re-check). The backend's retry
endpoint re-checks the live directive and refuses everything the UI hides — recorded here because
the reverse reading (client-only check) would be a compliance hole.

**TASK-014's conversions list upgraded in place, as that task anticipated.** The
"Available after upload is enabled" label is retired: the simple list now renders real per-platform
upload states (one line per platform, never a blended status) and links to the full diagnostics
view. The TASK-014 component and e2e specs' upload-column assertions were updated to the new
reality in this commit.

**Gates.** `lint`, `typecheck`, `test`, `build`, `check:i18n`, `check:tokens`, `check:boundaries`,
`check:connect-bundle`, and admin/ui/i18n/api-client suites all green (400 admin + 353 ui unit/
component tests; the new-taxonomy exhaustive coverage is in
`src/lib/advertising/diagnostics.test.ts` and `__tests__/AdvertisingDiagnostics.test.ts`). Known
reds, all verified on a clean `main` worktree at 7201259 before this commit:

- `check:budget` red on marketing (124.6 → 129.6 KB with this slice's copy / 123 KB budget) and
  storefront (153.5 → 158.4 KB / 151 KB) — the shared i18n-catalog problem tracked as TASK-032,
  red on base already; per the no-further-raise decision, the budgets are not raised again here.
- Admin e2e: campaigns ×2 and payments-onboarding ×2 (both engines) fail identically on base;
  the 14 new diagnostics/audiences e2e assertions and the updated TASK-014 tracking spec pass on
  chromium + webkit.

Prerelease tag/staging deploy not run (no pipeline in this environment), same as TASK-009/014.
