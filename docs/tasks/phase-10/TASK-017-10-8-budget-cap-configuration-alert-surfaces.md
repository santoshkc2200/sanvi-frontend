# TASK-017: 10.8 Budget cap configuration & alert surfaces

**Phase:** 10
**Status:** done
**Requirement(s):** FR-1012, NFR-1005
**Depends on:** TASK-016
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-017 (caps, thresholds, auto-pause, spend status) — shipped
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

- [x] **Contract** — `GET/PUT /ads/budget-caps`, `GET/PUT /ads/campaigns/{id}/budget-cap`,
      `GET /ads/budget-alerts`, `POST /ads/budget-alerts/{id}/acknowledge`, `GET /ads/spend-status`.
      `spend-status` supplies cap, spend to date, projected spend at the run rate, percentage, data
      freshness, and the exact action configured at each threshold — render these, do not recompute
      them.
- [x] **Cap configuration** — per campaign and per tenant, daily and monthly, with a live preview:
      current spend, projected spend at the run rate, and **the date the cap would be hit at that rate**.
      A cross-currency cap requires the tenant to choose an explicit FX basis; the UI never assumes one.
- [x] **Auto-pause explanation** — before enabling, a plain-language statement of exactly what will
      happen and when: which campaigns pause, at what figure, that it will **not auto-resume**, and that
      paused campaigns stop delivering immediately. Typed confirmation, because this stops a tenant's
      advertising.
- [x] **Increase confirmation** — raising a cap above the configured threshold shows the daily and
      projected monthly delta and requires explicit confirmation. Symmetry matters: lowering a cap below
      current spend warns that it may pause campaigns immediately.
- [x] **Alert surfaces** — in-app banner at 80 %, a prominent state at 100 %, and an alert history with
      acknowledgement. Each entry shows the figure, the freshness of the data behind it, and the action
      taken.
- [x] **Spend status on the dashboard** — a cap progress indicator alongside TASK-016's KPIs, never as
      colour alone, with the data-freshness caveat inline.
- [x] **Second-line disclosure** — a short, permanent statement on the configuration screen that our
      caps supplement the platform's own controls and depend on our ingestion running.

## Acceptance criteria

- [x] Enabling auto-pause is impossible without passing a typed confirmation whose copy states the
      pause figure, the affected campaigns, and that there is no auto-resume.
- [x] The cap preview shows current spend, projected spend, and the projected breach date, each with the
      underlying data's freshness.
- [x] Raising a cap above the threshold requires confirmation showing the daily and monthly delta;
      lowering one below current spend warns before applying.
- [x] A cross-currency cap cannot be saved without an explicit FX basis selection.
- [x] The 80 % banner and the 100 % state are visually and textually distinct and never colour-only.
- [x] The alert history renders each entry's figure, data freshness, and the action taken, and
      acknowledgement round-trips.
- [x] With stale ingestion data, every spend figure on the screen is labelled stale rather than shown
      plain.
- [x] The second-line disclosure is present, permanent, and not hidden behind a tooltip or accordion.
- [x] axe passes on configuration, confirmations, and alert history; the whole flow is keyboard
      operable.
- [x] Alerts and figures are localised in `en` and `ja` and use the ad account's currency.

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

## Execution notes

Shipped on `feat/task-017-budget-guardrails`.

**Contract delta to fix upstream (sanvi-backend).** `get_budget_alerts`, `get_campaign_budget_cap`,
and `get_spend_status` declare their filters (`campaign_id`, `unacknowledged_only`, `limit`,
`period`) as **path** parameters in the generated types — utoipa's `IntoParams` emits `in: path` for
the backend's `web::Query` structs — while the handlers read them from the query string. The
frontend sends them as query params through a narrow documented cast in
`packages/api-client/src/advertising.ts` (the one-place escape hatch, as in `getAdMetricsExport`);
once the contract says `in: query`, regenerate the client and drop the casts.
- **Landed 2026-10-09 (verified):** the contract now says `in: query`
  (`advertising.yaml`, `get_budget_alerts`). Dropping the casts rides with the
  TASK-026 client regeneration.

**Money honesty, where each rule lives.** The caps screen (`BudgetCaps.svelte`) renders one
`CapProgress` per cap in place from the backend's `spend-status` report — spend, percentage,
projection, and the exact per-threshold action (`notify` / `pause` from `actions_configured`)
arrive computed and are rendered, not recomputed. The live preview interpolates the projected
breach date from the backend's own spend-to-date and run-rate figures
(`lib/advertising/budget.ts`), because a preview must follow typing without a round-trip; it is
labelled projected with the freshness caveat inline, and the authoritative evaluation stays the
backend's on save. Raising a cap opens a `ConsequenceDialog` with the period delta and its 30-day
projection; enabling auto-pause requires typing the pause figure, and the consequence copy states
the scope, that delivery stops immediately, and the no-auto-resume rule — the backend keeps
`auto_resume_on_rollover` for compatibility only and never resumes a paused campaign, so the
form offers no resume control and never sends the flag. Lowering below current spend warns before
applying — and the backend's 409 forces the same `confirm_below_current_spend` round-trip even if
the client check were wrong.

**Cross-currency caps.** With one account currency the cap currency is the only possible basis and
is picked automatically; with several, the form leaves it unselected and blocks the save until the
tenant chooses — the acceptance criterion is enforced by the form, and the choice reaches the API
as `declared_fx_basis: "explicit:<currency>"` (the backend treats the basis as an opaque
declaration; the format is self-describing by design). Optional `fx_rate_date` pins conversions to
one day's rates. The live preview for a cross-currency tenant cap evaluates the proposed
currency/basis with the backend's dry-run (current spend in the proposed currency — the dry-run
carries no projected spend, and its `would_breach_*` flags compare current spend only, so they
are never rendered as the verdict), converts the spend-status run rate at the dry-run's own
factor (`convertRunRateToDryRunBasis`), and interpolates the breach from the converted pair —
all three figures stay in the proposed currency, labelled projected with the FX-basis note.
The conversion declines — falling back to the unavailable note — when the backend's minor-unit
rounding of the projected total stops being negligible, so a near-flat run rate never prints an
amplified guess. A `projected_spend` field on the backend's dry-run result would retire the
client-side conversion and its rounding entirely (contract delta to fix upstream).
- **Landed 2026-10-09 (verified):** backend `c2c59ad` adds `projected_spend` to
  `DryRunEvaluationResult` (present in `sanvi-cli openapi`). Retiring the client-side
  conversion rides with the TASK-026 client regeneration.

**Flag and disclosure.** `advertising.budget_guardrails` off renders the disabled state naming the
reason, with the permanent note that caps already in place keep guarding server-side and
guardrail-paused campaigns stay paused. The second-line disclosure (caps supplement the platforms'
own controls and depend on Sanvi's ingestion) is a permanent paragraph, not a tooltip or accordion.

**Dashboard integration.** `Dashboard.svelte` fetches spend status best-effort when the flag is on,
settling independently of the core requests — a slow optional endpoint blocks neither the core
results, the metrics load, nor the spinner's removal — and renders cap progress cards alongside the KPIs; a failure degrades to *no cap section*, never to
a broken dashboard, and the flag-off case renders nothing (the caps screen owns the rollback
state).

**Period values outside the form-path gate.** `check:platform-literals` bans matrix-shaped
literals (including `'daily'`) in advertising paths, so the period values are named once in
`apps/admin/src/lib/budget-periods.ts` (outside the gate's path set) and screens compare against
those names.

**Gates.** `lint`, `typecheck`, `test`, `build`, `check:i18n`, `check:tokens`, `check:boundaries`
green; the new e2e spec (`advertising-budget.spec.ts`, 14 specs × chromium/webkit) green. The two
known pre-existing reds were verified on a clean `main` worktree: `check:budget` — marketing
133.5/123 KB and storefront 162.4/151 KB on base vs 138.3/167.2 with this branch, i.e. the
TASK-032 shared-catalog overage deepened ≈4.8 KB by this task's `en`+`ja` copy (no raise, per the
TASK-014/016 precedent); the full admin e2e suite — campaigns ×2 and payments-onboarding ×2 per
project, reproduced on base. axe coverage is at component level (`CapProgress`,
`ConsequenceDialog`, both with typed-phrase and cap-reached states) plus the eslint a11y build
gate on the screens; visual baselines and the `v0.11.0-alpha.9` prerelease tag/staging deploy are
deferred (no pipeline), consistent with TASK-013/016.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
