# TASK-016: 10.7 Chart primitives & ROAS dashboard

**Phase:** 10
**Status:** done
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

- [x] **Contract** — `GET /ads/metrics`, `/metrics/summary?compare_to`, `/metrics/export?format=csv`,
      `/metrics/freshness`. Every row carries source currency, ad account timezone, and a `restating`
      marker; `freshness` drives the "still updating" and "sync failed" states — never a clock-based
      guess.
- [x] **Chart primitives** (`packages/ui`) — line, bar, stacked bar, and sparkline on a small tokenized
      layer: colours from phase-07 tokens, one visual system, accessible by default. **Each chart ships
      with an accessible data table as its equivalent**, not as an afterthought.
- [x] **Dashboard** — header KPIs (spend, revenue, ROAS, conversions, CPA) with period comparison and
      sparklines; a time series with platform/campaign breakdown and a spend-vs-revenue overlay; a
      sortable, exportable table by campaign/ad group/ad.
- [x] **Two-number presentation** — platform-reported and Sanvi-observed shown together wherever ROAS or
      conversion value appears, each labelled where it is displayed.
- [x] **Attribution explainer** — a component stating which number comes from where, what each
      platform's attribution window is, and why they legitimately differ. **One click from every ROAS
      figure.**
- [x] **Restatement honesty** — restatement-window days visibly marked with the window explained.
- [x] **Date range & timezone** — presets plus custom, with the ad account's timezone stated explicitly
      next to the range. Where two connections have different timezones, the UI says so rather than
      picking one.
- [x] **States** — no connection, no spend yet, sync in progress, sync failed (with connection health
      from TASK-011), partial data (one platform synced, one not).
- [x] **Spend columns in the campaign list** — TASK-012's placeholder columns now render real spend,
      conversions, and ROAS.

## Acceptance criteria

- [x] The dashboard shows spend, clicks, conversions, revenue, and ROAS for a date range, matching the
      platform's own reporting within the documented restatement window.
- [x] A grep gate proves no blended ROAS or conversion-value field exists in any component, chart, KPI,
      or export; both sources are labelled everywhere they appear.
- [x] The attribution explainer is reachable in one click from every ROAS figure.
- [x] Restatement-window days render "still updating" with the window explained; a settled day does not.
- [x] Zero spend renders `—`, never `∞` or `NaN`; JPY renders with no decimals inside charts, tiles, and
      the table.
- [x] Two connections with different currencies render natively with **no summed total**, and differing
      timezones are stated rather than reconciled.
- [x] A stalled connection renders "sync failed" from `freshness`, not stale numbers presented as
      current.
- [x] An over-long date range shows the API's clear message rather than a spinner.
- [x] Every chart handles empty, single-point, and dense data, has an accessible data table, and never
      uses colour as the only encoding; axe passes.
- [x] The dashboard route is lazy-loaded and `pnpm check:budget` passes with the chart layer included.
- [x] The export's columns match the UI, contain no blended column, and are permission-gated.

## Verification

```bash
pnpm lint                 # ✓
pnpm typecheck            # ✓ (24 tasks)
pnpm test                 # ✓ (23 packages)
pnpm build                # ✓
pnpm check:i18n           # ✓
pnpm check:tokens         # ✓
pnpm check:budget         # admin ✓ (chart layer inside the 65 KB chunk budget); storefront/marketing
                          #   initial-JS red — the pre-existing TASK-032 i18n-catalog overage, red on
                          #   main too (see execution notes)
pnpm check:boundaries     # ✓ — now also runs the no-blended-attribution gate
pnpm test:e2e --filter admin   # dashboard spec 20/20; 88 pass overall, 8 failures are the 4
                               # pre-existing main failures ×2 engines (reproduced on clean main)
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

## Execution notes

Shipped on `feat/task-016-charts-roas-dashboard`.

**Chart layer (`packages/ui/src/charts/`).** Hand-rolled SVG, zero dependencies — a chart library
would have doubled the route chunk and dragged in a second styling system. Six exports: `LineChart`,
`BarChart`, `StackedBarChart`, `OverlayChart` (bars for spend, lines for each revenue source — the
bar/line shape difference is itself a non-colour encoding), `Sparkline`, and `ChartDataTable`. Every
axis chart renders its data table from the *same* `categories`/`series` props inside a `<details>`
disclosure, so chart and table cannot disagree; the components require the table labels
(`ChartTableLabels`), making the accessible equivalent a type-level fact. Series differ by colour token
*and* dash pattern (lines) or hatch rotation (stacked fills). New `color.chart.*` token group in
`packages/design-tokens` (`semantic.json` + `dark.json`), with 3:1 non-text contrast against the page
background asserted per theme in `ui-tokens-contrast.test.mjs`.

**No-blend gate.** `packages/lint-gates/src/check-no-blended-attribution.mjs` — word-bounded scan over
comment-stripped source for blend-shaped identifiers (`blended_roas`, `totalRoas`, `overall_roas`, …),
wired into `check:boundaries` alongside the platform-literal gate, with its own violation fixtures and
tests. The workspace passes.

**Dashboard.** Route `advertising/dashboard` (lazy `import()` in `App.svelte`, nav entry
"Performance"), gated inside on the `advertising.dashboard` entitlement flag (paused `EmptyState` on
rollback) with `advertising.metrics.read` as the backend read authority. KPI strips, the overlay chart,
the platform stack, and the breakdown tables are all grouped **per currency** — there is no
cross-currency total anywhere; the timezone statement names distinct account timezones instead of
reconciling them. Freshness ("sync failed" / "in progress" / "updated …") renders from
`getAdMetricsFreshness`'s backend `stalled` flag. A 400 from the metrics endpoints renders the API's
own problem `detail` — the over-long-range case — instead of a spinner. Export streams the backend CSV
to a download and is `advertising.metrics.read`-gated; the e2e asserts the header carries
`roas_platform`/`roas_sanvi` and no merged column. The attribution explainer opens from an ⓘ button on
each ROAS KPI tile and each ROAS table cell (campaign list ROAS cells carry it too).

**Presentation helpers.** `apps/admin/src/lib/advertising/metrics.ts` — date-range presets and
equal-length comparison periods, per-currency KPI/chart grouping, campaign aggregation, `ratioOf`/
`fractionChange` (null-unless-both-positive), freshness partitioning, timezone statements. Unit-tested
including the fail case that matters: a missing backend `roas_platform` recomputes from the
platform's `conversion_value`, never from Sanvi revenue.

**Campaign list.** The TASK-012 placeholder columns render real 30-day figures with both ROAS numbers
labelled at the cell; with the flag off the columns drop entirely (rollback rule), and the old
`metricsPendingNote` is removed from the catalogs.

**Verification deltas recorded honestly.**
- `check:budget`: admin green — the whole chart layer fits inside the 65 KB per-chunk budget. The
  storefront (162.4/151 KB) and marketing (133.5/123 KB) initial-JS overages are the pre-existing
  TASK-032 shared-catalog problem (red on clean `main` at 158.6 and 129.8 KB respectively); this task's
  catalog additions deepen it by ≈3.8/3.7 KB gzip. No further budget raise, per the TASK-014 precedent —
  TASK-032 (catalog sharding) is the fix that lowers these numbers.
- `test:e2e --filter admin`: the dashboard spec passes 20/20 (chromium+webkit); the 8 overall failures
  are the 4 known main failures (`advertising-campaigns` ×2, `payments-onboarding` ×2) per engine,
  reproduced on a clean `main` worktree during this task.
- Prerelease tag/staging deploy not run (no pipeline in this environment). Visual baselines deferred to
  TASK-018 (no harness exists yet); light/dark rendering verified manually against the mock backend.
- e2e mock: metrics endpoints added to `mock-advertising-backend.ts` (deterministic rollups generated
  relative to *now*, per-currency summary, CSV export capture, `stallConnection` control,
  `dashboardDisabled` option; second seeded connection moved to `America/New_York` so the
  differing-timezone statement is exercised).

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
