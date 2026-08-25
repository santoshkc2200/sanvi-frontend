# TASK-016: 10.7 Chart primitives & ROAS dashboard

**Phase:** 10
**Status:** todo
**Requirement(s):** FR-1010, FR-1011, NFR-1002, NFR-1005, NFR-1006, NFR-1007
**Depends on:** TASK-012, TASK-015
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-016 (metrics, summary, export, freshness)
**Slice:** 10.7 — Metrics ingestion, rollups & ROAS dashboard
**Prerelease:** `v0.11.0-alpha.8` · **Flag:** `advertising.dashboard`

## Context

The screen the phase exists for: *is this advertising making me money?* — answered with numbers the
tenant can trust and a methodology they can see.

**The three rules that shape every pixel here:**

1. **Two numbers, both labelled, never merged.** Platform-reported conversion value and Sanvi-observed
   revenue appear side by side wherever ROAS or conversion value appears, each labelled **at the point
   of display**, not in a footnote. No blended KPI tile, no blended chart series, no blended export
   column. A merged attribution number is a confident lie, and once one ships it cannot be withdrawn.
2. **A number that will change is never rendered as settled.** Days inside the platform's restatement
   window are visibly marked "still updating", with the window explained.
3. **Timezone and currency are stated, never assumed.** "Yesterday" differs per ad account. Sums across
   accounts in different currencies do not exist.

The chart primitives are a `@sanvi/ui` deliverable, not dashboard-local components: charts drift into a
second design system if left to each screen. They are built against TASK-009's fixed metric shapes and
can start before the ingestion backend lands.

## What to do

- [ ] **Contract** — `GET /ads/metrics`, `/metrics/summary?compare_to`, `/metrics/export?format=csv`,
      `/metrics/freshness`. Every row carries source currency, ad account timezone, and a `restating`
      marker; `freshness` drives the "still updating" and "sync failed" states — never a clock-based
      guess.
- [ ] **Chart primitives** (`packages/ui`) — line, bar, stacked bar, and sparkline on a small tokenized
      layer: colours from phase-07 tokens, one visual system, accessible by default. **Each chart ships
      with an accessible data table as its equivalent**, not as an afterthought.
- [ ] **Dashboard** — header KPIs (spend, revenue, ROAS, conversions, CPA) with period comparison and
      sparklines; a time series with platform/campaign breakdown and a spend-vs-revenue overlay; a
      sortable, exportable table by campaign/ad group/ad.
- [ ] **Two-number presentation** — platform-reported and Sanvi-observed shown together wherever ROAS or
      conversion value appears, each labelled where it is displayed.
- [ ] **Attribution explainer** — a component stating which number comes from where, what each
      platform's attribution window is, and why they legitimately differ. **One click from every ROAS
      figure.**
- [ ] **Restatement honesty** — restatement-window days visibly marked with the window explained.
- [ ] **Date range & timezone** — presets plus custom, with the ad account's timezone stated explicitly
      next to the range. Where two connections have different timezones, the UI says so rather than
      picking one.
- [ ] **States** — no connection, no spend yet, sync in progress, sync failed (with connection health
      from TASK-011), partial data (one platform synced, one not).
- [ ] **Spend columns in the campaign list** — TASK-012's placeholder columns now render real spend,
      conversions, and ROAS.

## Acceptance criteria

- [ ] The dashboard shows spend, clicks, conversions, revenue, and ROAS for a date range, matching the
      platform's own reporting within the documented restatement window.
- [ ] A grep gate proves no blended ROAS or conversion-value field exists in any component, chart, KPI,
      or export; both sources are labelled everywhere they appear.
- [ ] The attribution explainer is reachable in one click from every ROAS figure.
- [ ] Restatement-window days render "still updating" with the window explained; a settled day does not.
- [ ] Zero spend renders `—`, never `∞` or `NaN`; JPY renders with no decimals inside charts, tiles, and
      the table.
- [ ] Two connections with different currencies render natively with **no summed total**, and differing
      timezones are stated rather than reconciled.
- [ ] A stalled connection renders "sync failed" from `freshness`, not stale numbers presented as
      current.
- [ ] An over-long date range shows the API's clear message rather than a spinner.
- [ ] Every chart handles empty, single-point, and dense data, has an accessible data table, and never
      uses colour as the only encoding; axe passes.
- [ ] The dashboard route is lazy-loaded and `pnpm check:budget` passes with the chart layer included.
- [ ] The export's columns match the UI, contain no blended column, and are permission-gated.

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

Budget cap progress and alert surfaces (TASK-017), the phase-wide a11y/visual/export sweep (TASK-018),
and any bidding or optimisation recommendation UI (not in this release).

## Files likely touched

- `packages/ui/src/charts/**` (line, bar, stacked, sparkline, data-table equivalent)
- `apps/admin/src/routes/advertising/Dashboard.svelte` (lazy-loaded route)
- `packages/ui/src/advertising/AttributionExplainer.svelte`
- `apps/admin/src/routes/advertising/Campaigns.svelte` (real spend columns)
- `packages/i18n` catalogs (`en`, `ja`) — methodology copy, restatement and freshness states
- admin e2e specs, visual snapshots

## Notes / gotchas

- Rollback: `advertising.dashboard` off → dashboard routes hide and metrics endpoints return `503`. The
  campaign list degrades to **showing no spend column** rather than showing zeros, which would read as
  "you spent nothing".
- Build the charts against fixtures from TASK-009's metric shapes; do not wait for live ingestion.
- The single most tempting mistake in this task is one tidy ROAS number. It is also the one thing that
  cannot be walked back once tenants have seen it.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
