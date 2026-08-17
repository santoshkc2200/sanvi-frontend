# Phase 10 — Advertising Manager & ROAS Dashboard (frontend)

**Target version:** 0.11.0
**Depends on:** frontend 01–09; backend 10
**Unlocks:** tenants running paid acquisition without leaving Sanvi

## Goal

A campaign manager that is genuinely faster than the native ad tools for the common case, and a
performance dashboard that answers the only question tenants really ask: *is this advertising making
me money?* — with numbers they can trust and a methodology they can see.

## Scope

**In**
- Ad platform connection UI (Google Ads, Meta), account selection, health and re-consent.
- Campaign manager: list, create/edit (platform-aware), budgets, schedules, pause/resume, drift.
- Creative management: assets, copy per locale, previews per placement.
- Performance dashboard: spend, impressions, clicks, conversions, revenue, ROAS, with breakdowns.
- Conversion tracking setup UI and a diagnostics view showing whether tracking actually works.
- Budget alerts and spend guardrails.

**Out**
- Automated bidding/optimisation recommendations (the data model supports it; the UI is later).
- Ad platforms beyond Google and Meta in this release.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Unified UI, platform-aware forms | One campaign builder whose fields are driven by the platform's capability matrix | A false "one form fits all" produces invalid campaigns; a capability-driven form produces valid ones |
| Drift, not overwrite | Changes made in the native tools are shown as "changed outside Sanvi" with a diff and an explicit choice | Silently overwriting a tenant's Google Ads edit is unforgivable |
| Two ROAS numbers | Platform-reported conversion value **and** Sanvi-observed revenue, side by side, both labelled, with the methodology one click away | Attribution windows differ; a single blended number is a confident lie |
| Restatement honesty | Recent days marked "still updating" with the platform's restatement window explained | Yesterday's numbers change; pretending otherwise destroys trust |
| Charts | `@sanvi/ui` chart set built on a small, tokenized layer — colours from tokens, accessible by default, one visual system across the product | Charts drift into a second design system if left to each screen |
| Currency | Ad account currency shown natively; conversion to the tenant's currency is explicit, with the FX date | Silently converted money is a support ticket |
| Consent linkage | Tracking setup surfaces the privacy dependency: without `ads_measurement` — or with a US opt-out of sale/share, including one expressed via GPC — conversions are not uploaded, and the UI says which purpose and which signal suppressed them | The tenant needs to understand why numbers differ from the native tools, and "some visitors opted out" is a very different conversation from "tracking is broken" |
| Guardrails | Budget caps and alerts are first-class UI, with auto-pause clearly explained | Real money moves here |

## Deliverables

### 1. Connections

- Platform cards (entitlement-gated), OAuth start with a clear scope explanation, account picker for
  users with multiple ad accounts or manager accounts.
- Connection health: token validity, last sync time, permission changes requiring re-consent, and an
  explicit "reconnect" path that does not lose campaign history.
- Disconnect with consequences (metrics stop updating, conversion uploads stop; campaigns keep
  running on the platform — stated plainly, since that surprises people).

### 2. Campaign manager

| Screen | Contents |
|---|---|
| Campaign list | Cross-platform table: name, platform badge, status, budget, spend today/period, conversions, ROAS, drift indicator; bulk pause/resume |
| Campaign builder | Stepper: objective → audience/targeting → budget & schedule → creatives → review. Fields render from the platform capability matrix; unsupported options are absent, not broken |
| Campaign detail | Performance over time, ad groups/ads, review status per ad (with rejection reasons), change log ("who paused this") |
| Creatives | Asset upload with per-placement previews, copy fields per locale with character counters that reflect each platform's limits |
| Drift | Diff view: our intent vs the platform's current state, with "keep theirs" / "reapply ours" |

Validation happens before submission using the same capability matrix the backend enforces, so users
see errors in the form rather than as an API failure after a long wait.

### 3. Performance dashboard

- Header KPIs: spend, revenue, ROAS, conversions, CPA — with period comparison and sparklines.
- Time series with platform/campaign breakdown; stacked spend vs revenue overlay.
- Table by campaign/ad group/ad, sortable, exportable.
- Attribution note component: which numbers come from where, what the windows are, why they differ.
- Date range with sensible presets, timezone stated explicitly (ad accounts have their own timezones,
  and this is a classic source of "your numbers are wrong" tickets).
- Empty and partial states: no connection, no spend yet, sync in progress, sync failed.

### 4. Conversion tracking setup & diagnostics

- Setup: which events are tracked, where they fire, and how they map to each platform's conversion
  actions; a one-click test event with live confirmation.
- Diagnostics: recent conversions with per-platform upload status, dedupe status, and the reason for
  any suppression (missing consent, opt-out of sale/share, browser privacy signal, missing click id,
  upload error) — the screen that turns "the numbers look wrong" into a specific, fixable cause, and
  distinguishes the causes a tenant can fix from the ones they must respect.
- Health banner when uploads are failing or when privacy directives are suppressing a large share,
  with the split between consent-absent and opted-out so the tenant reads the right signal.

### 5. Budget guardrails

Per-campaign and per-tenant caps, threshold alerts (80 %/100 %), auto-pause configuration with a
plain-language explanation of exactly what will happen and when, plus an alert history.

## Work breakdown

1. Connection screens, OAuth handoff, account picker, health and re-consent states.
2. Capability-matrix-driven form engine (schema → fields → validation) shared by both platforms.
3. Campaign list, builder, detail, and change log.
4. Creative management with per-placement previews and locale-aware copy limits.
5. Chart primitives in `@sanvi/ui` (line, bar, stacked, sparkline) — tokenized, accessible, with data
   tables as the accessible equivalent.
6. Dashboard composition, breakdowns, comparisons, export.
7. Attribution/methodology explainer components.
8. Tracking setup + diagnostics + test event.
9. Budget guardrails and alert surfaces.
10. E2E across both platforms against a mocked backend, plus a sandbox smoke test.

## Testing

- Component: form engine against fixture capability matrices (a field unsupported by Meta must not
  render for Meta); every chart with empty, single-point, and dense data; loading/error states.
- Unit: ROAS/CPA math including zero spend and zero revenue; currency and FX display; date-range and
  timezone handling; restatement labelling.
- E2E: connect (mocked OAuth) → create campaign → see it in the list → pause → see the change log;
  drift scenario shows a diff and does not auto-overwrite; diagnostics shows a consent-suppressed
  conversion with the correct reason.
- a11y: charts have text alternatives and accessible data tables; colour is never the only encoding;
  keyboard navigation through the campaign builder.
- Visual: dashboard across themes and locales; Japanese number/currency formatting in charts.

## Security

- OAuth flows use the backend-issued signed `state`; the frontend never handles ad platform tokens.
- Ad account changes require step-up authentication (this is money-adjacent).
- No PII in chart payloads or exports beyond what the tenant already holds; export is permission-gated.
- Conversion diagnostics show hashed identifiers only, never raw customer data.
- Third-party pixels (if a tenant adds one) load only through the consent-gated loader from phase 05.

## Acceptance criteria

- [ ] A tenant connects Google Ads and Meta, creates a campaign, and sees it live on the platform.
- [ ] The dashboard shows spend, conversions, revenue, and ROAS with both attribution sources
      labelled and a methodology explanation available.
- [ ] Recent-day restatement is visibly flagged rather than silently wrong.
- [ ] Tracking diagnostics correctly explain a consent-suppressed conversion and an opt-out-suppressed
      one, naming the purpose and the signal source.
- [ ] A campaign changed natively appears as drifted with a diff and an explicit resolution choice.
- [ ] Budget threshold alerts fire and auto-pause behaves exactly as the UI described.

## Risks

| Risk | Mitigation |
|---|---|
| Numbers disagree with the native platform UI | Methodology explainer, restatement flags, timezone clarity, and diagnostics that show the actual pipeline |
| Campaign builder cannot express what an advanced user wants | Deep link to the native tool for advanced editing; drift handling makes that safe |
| Chart complexity balloons the bundle | Small tokenized chart layer, lazy-loaded dashboard route, budget enforced |
| Tenants overspend through our UI | Caps, alerts, auto-pause, change log, and confirmation on budget increases above a threshold |
| Platform UI/API changes break the builder | Capability matrices are backend-provided data; a platform change is a data update, not a frontend release |
