# TASK-017: 10.8 Budget cap configuration & alert surfaces

**Phase:** 10
**Status:** todo
**Requirement(s):** FR-1012, NFR-1005
**Depends on:** TASK-016
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-017 (caps, thresholds, auto-pause, spend status)
**Slice:** 10.8 — Budget guardrails & spend alerts
**Prerelease:** `v0.11.0-alpha.9` · **Flag:** `advertising.budget_guardrails`

## Context

A tenant sets a cap, and the cap holds. This screen's obligation is that **auto-pause behaves exactly
as the UI said it would** — same figures, same timing, same non-resume behaviour. A guardrail that
surprises the tenant is worse than no guardrail, because they stopped watching.

Two honesty requirements run through every surface here:

1. **Every figure carries its freshness.** Spend to date is only as trustworthy as the last ingestion,
   and the screen says which.
2. **We are a second line, never the only one.** Our caps supplement the platform's own controls and
   depend on our ingestion running. That is a permanent statement on the configuration screen, not a
   tooltip.

## What to do

- [ ] **Contract** — `GET/PUT /ads/budget-caps`, `GET/PUT /ads/campaigns/{id}/budget-cap`,
      `GET /ads/budget-alerts`, `POST /ads/budget-alerts/{id}/acknowledge`, `GET /ads/spend-status`.
      `spend-status` supplies cap, spend to date, projected spend at the run rate, percentage, data
      freshness, and the exact action configured at each threshold — render these, do not recompute
      them.
- [ ] **Cap configuration** — per campaign and per tenant, daily and monthly, with a live preview:
      current spend, projected spend at the run rate, and **the date the cap would be hit at that rate**.
      A cross-currency cap requires the tenant to choose an explicit FX basis; the UI never assumes one.
- [ ] **Auto-pause explanation** — before enabling, a plain-language statement of exactly what will
      happen and when: which campaigns pause, at what figure, that it will **not auto-resume**, and that
      paused campaigns stop delivering immediately. Typed confirmation, because this stops a tenant's
      advertising.
- [ ] **Increase confirmation** — raising a cap above the configured threshold shows the daily and
      projected monthly delta and requires explicit confirmation. Symmetry matters: lowering a cap below
      current spend warns that it may pause campaigns immediately.
- [ ] **Alert surfaces** — in-app banner at 80 %, a prominent state at 100 %, and an alert history with
      acknowledgement. Each entry shows the figure, the freshness of the data behind it, and the action
      taken.
- [ ] **Spend status on the dashboard** — a cap progress indicator alongside TASK-016's KPIs, never as
      colour alone, with the data-freshness caveat inline.
- [ ] **Second-line disclosure** — a short, permanent statement on the configuration screen that our
      caps supplement the platform's own controls and depend on our ingestion running.

## Acceptance criteria

- [ ] Enabling auto-pause is impossible without passing a typed confirmation whose copy states the
      pause figure, the affected campaigns, and that there is no auto-resume.
- [ ] The cap preview shows current spend, projected spend, and the projected breach date, each with the
      underlying data's freshness.
- [ ] Raising a cap above the threshold requires confirmation showing the daily and monthly delta;
      lowering one below current spend warns before applying.
- [ ] A cross-currency cap cannot be saved without an explicit FX basis selection.
- [ ] The 80 % banner and the 100 % state are visually and textually distinct and never colour-only.
- [ ] The alert history renders each entry's figure, data freshness, and the action taken, and
      acknowledgement round-trips.
- [ ] With stale ingestion data, every spend figure on the screen is labelled stale rather than shown
      plain.
- [ ] The second-line disclosure is present, permanent, and not hidden behind a tooltip or accordion.
- [ ] axe passes on configuration, confirmations, and alert history; the whole flow is keyboard
      operable.
- [ ] Alerts and figures are localised in `en` and `ja` and use the ad account's currency.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:i18n
pnpm check:tokens
pnpm check:budget
pnpm check:boundaries
pnpm test:e2e --filter admin
```

## Out of scope

The threshold evaluator, auto-pause execution, dry-run computation, and anomaly detection — all
backend TASK-017. This task renders their results and their configuration.

## Files likely touched

- `apps/admin/src/routes/advertising/{BudgetCaps,BudgetAlerts}.svelte`
- `packages/ui/src/advertising/{CapProgress,ConsequenceDialog}.svelte`
- `apps/admin/src/routes/advertising/Dashboard.svelte` (cap progress indicator)
- `packages/api-client/src/advertising.ts`
- `packages/i18n` catalogs (`en`, `ja`) — consequence copy, alert history, freshness caveats
- admin e2e specs

## Notes / gotchas

- Rollback: `advertising.budget_guardrails` off → the configuration screen shows a disabled state
  **naming the reason**, and every tenant with an active cap is notified. A guardrail that silently
  stops guarding is the worst outcome available on this screen. Campaigns already paused by a guardrail
  stay paused.
- The consequence copy must match the backend's actual behaviour word for word. If they disagree, the
  UI is not the thing to fix.
- Never render a spend figure without its freshness. Every support ticket in this area starts with a
  number that looked settled.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
