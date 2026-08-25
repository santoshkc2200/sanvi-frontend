# Phase 10 — Advertising Manager & ROAS Dashboard (frontend)

**Version:** 0.11.0 · **Status:** not started — blocked behind the phase-09 frontend backlog
**Depends on:** frontend 01–09; backend 10 · **Unlocks:** tenants running paid acquisition without
leaving Sanvi

**This document is the phase spec — the *what* and *why*.** Slice order and per-slice exit criteria
live in [`../tasks/phase-10/README.md`](../tasks/phase-10/README.md); the executable step-by-step
breakdown lives in the ten `TASK-0NN` files beside it. Status lives in
[`../tasks/backlog.md`](../tasks/backlog.md).

---

## 1. Goal

A campaign manager genuinely faster than the native ad tools for the common case, and a performance
dashboard that answers the only question tenants actually ask — *is this advertising making me
money?* — with numbers they can trust and a methodology they can see.

## 2. Progress

Verified 2026-08-25 against the working tree.

| Slice | Task | Status | Blocked by |
|---|---|---|---|
| 10.0 generated client, CSP & advertising shell | TASK-009 | ⬜ todo | frontend phase 09 |
| 10.1 capability-driven form engine & catalog | TASK-010 | ⬜ todo | 10.0 |
| 10.2 connection screens, OAuth handoff & health | TASK-011 | ⬜ todo | 10.1 |
| 10.3 campaign list, builder, detail & drift | TASK-012 | ⬜ todo | 10.2 |
| 10.4 creative management & placement previews | TASK-013 | ⬜ todo | 10.3 |
| 10.5 tracking setup, storefront beacon & test event | TASK-014 | ⬜ todo | 10.2 |
| 10.6 conversion diagnostics & audience management | TASK-015 | ⬜ todo | 10.5 |
| 10.7 chart primitives & ROAS dashboard | TASK-016 | ⬜ todo | 10.3, 10.5 |
| 10.8 budget cap configuration & alert surfaces | TASK-017 | ⬜ todo | 10.7 |
| 10.9 a11y, visual, export hardening & e2e | TASK-018 | ⬜ todo | 10.4, 10.6, 10.8 |

**The real blocker is phase 09, not phase 10.** Only frontend TASK-001 (09.0) is done; 09.1–09.7 are
still `todo` while the backend has shipped through 09.7 and into 10.3. Phase 10 cannot start on
schedule until that gap closes, and the ROAS dashboard is meaningless without the phase-09 payment
surfaces it reads revenue from. Escalate the sequencing before planning 10.0.

**What is already unblocked from the backend side.** Backend 10.0–10.3 have shipped the contract
(`api/advertising.yaml`: platforms, connections, OAuth, campaign tree, publish, validate, pause,
resume, changes, drift) and the fake adapter's capability matrices are exported as fixtures at
`sanvi-backend/crates/contexts/advertising/fixtures/capability-matrices.json`. Slices 10.0–10.3 can
be built against those fixtures without waiting for Google developer-token approval or Meta app
review.

## 3. Scope

**In** — connection UI for Google Ads and Meta (account selection, health, re-consent) · campaign
manager (list, platform-aware create/edit, budgets, schedules, pause/resume, drift) · creative
management (assets, per-locale copy, per-placement previews) · performance dashboard (spend,
impressions, clicks, conversions, revenue, ROAS, breakdowns) · conversion tracking setup and
diagnostics · budget alerts and spend guardrails.

**Out** — automated bidding and optimisation recommendations (the data model supports it; the UI is
later) · ad platforms beyond Google and Meta this release.

## 4. Invariants

These mirror the backend's and are equally binding on the UI.

1. **Two numbers, never one.** Platform-reported conversion value and Sanvi-observed revenue are
   always shown side by side and labelled. No screen or export blends them.
2. **Drift is shown, never overwritten.** A change made in the native tool is surfaced as a diff with
   an explicit resolution choice.
3. **Real money moves here.** Caps, alerts, auto-pause, and confirmation on budget increases are
   first-class UI, not settings buried in a drawer.

## 5. Key decisions

| Decision | Choice | Why |
|---|---|---|
| Platform-aware forms | One campaign builder whose fields are driven by the platform's capability matrix | A false "one form fits all" produces invalid campaigns; a capability-driven form produces valid ones |
| Drift, not overwrite | Native-tool changes are shown as "changed outside Sanvi" with a diff and an explicit choice | Silently overwriting a tenant's Google Ads edit is unforgivable |
| Two ROAS numbers | Platform-reported conversion value **and** Sanvi-observed revenue, side by side, both labelled, methodology one click away | Attribution windows differ; a single blended number is a confident lie |
| Restatement honesty | Recent days marked "still updating", with the platform's restatement window explained | Yesterday's numbers change; pretending otherwise destroys trust |
| Charts | `@sanvi/ui` chart set on a small tokenized layer — colours from tokens, accessible by default | Charts drift into a second design system if left to each screen |
| Currency | Ad account currency shown natively; conversion to the tenant's currency is explicit, with the FX date | Silently converted money is a support ticket |
| Consent linkage | Tracking setup names the privacy dependency: without `ads_measurement`, or with a US opt-out of sale/share including one via GPC, conversions are not uploaded — and the UI says which purpose and which signal suppressed them | "Some visitors opted out" is a very different conversation from "tracking is broken" |

## 6. Deliverables

### 6.1 Connections — TASK-011

- Platform cards, entitlement-gated. OAuth start with a plain explanation of the scopes requested.
  Account picker for tenants with multiple ad accounts or a manager account.
- Connection health: token validity, last sync time, permission changes needing re-consent, and a
  reconnect path that does **not** lose campaign history.
- Disconnect states its consequences plainly: metrics stop updating and conversion uploads stop, but
  campaigns keep running on the platform. That last part surprises people, so it is said outright.

### 6.2 Campaign manager — TASK-012, TASK-013

| Screen | Contents |
|---|---|
| Campaign list | Cross-platform table: name, platform badge, status, budget, spend today/period, conversions, ROAS, drift indicator; bulk pause/resume |
| Campaign builder | Stepper: objective → audience/targeting → budget & schedule → creatives → review. Fields render from the capability matrix; unsupported options are **absent**, never broken |
| Campaign detail | Performance over time, ad groups/ads, per-ad review status with verbatim rejection reasons, change log ("who paused this") |
| Creatives | Asset upload with per-placement previews; copy fields per locale with character counters reflecting each platform's limits |
| Drift | Diff view — our intent vs. the platform's current state — with "keep theirs" / "reapply ours" |

Validation runs before submission using the same capability matrix the backend enforces, so users see
errors in the form rather than as an API failure after a long wait.

### 6.3 Performance dashboard — TASK-016

- Header KPIs: spend, revenue, ROAS, conversions, CPA — with period comparison and sparklines.
- Time series with platform/campaign breakdown; stacked spend vs. revenue overlay.
- Table by campaign / ad group / ad, sortable and exportable.
- Attribution note component: which numbers come from where, what the windows are, why they differ.
- Date range with presets, and the timezone stated explicitly — ad accounts carry their own timezone
  and this is a classic source of "your numbers are wrong" tickets.
- Empty and partial states: no connection, no spend yet, sync in progress, sync failed.

### 6.4 Tracking setup & diagnostics — TASK-014, TASK-015

- **Setup:** which events are tracked, where they fire, how they map to each platform's conversion
  actions, plus a one-click test event with live confirmation.
- **Diagnostics:** recent conversions with per-platform upload status, dedupe status, and the reason
  for any suppression — missing consent, opt-out of sale/share, browser privacy signal, missing click
  id, upload error. This is the screen that turns "the numbers look wrong" into a specific cause, and
  it distinguishes causes a tenant can fix from ones they must respect.
- **Health banner** when uploads are failing, or when privacy directives suppress a large share —
  split between consent-absent and opted-out so the tenant reads the right signal.

### 6.5 Budget guardrails — TASK-017

Per-campaign and per-tenant caps, threshold alerts at 80 % and 100 %, auto-pause configuration with a
plain-language description of exactly what will happen and when, plus an alert history.

## 7. Work breakdown → tasks

The ten numbered work-breakdown items and the task each lands in are maintained in
[`../tasks/phase-10/README.md`](../tasks/phase-10/README.md) § *Traceability to the implementation
plan*, so the mapping has one owner. Current status per slice is in § 2 above.

## 8. Testing

- **Component** — form engine against fixture capability matrices: a field Meta does not support must
  not render for Meta. Every chart with empty, single-point, and dense data. Loading and error states.
- **Unit** — ROAS and CPA math including zero spend and zero revenue; currency and FX display;
  date-range and timezone handling; restatement labelling.
- **E2E** — connect via mocked OAuth → create campaign → see it listed → pause → see the change log.
  A drift scenario shows a diff and does **not** auto-overwrite. Diagnostics shows a
  consent-suppressed conversion with the correct reason.
- **a11y** — charts carry text alternatives and accessible data tables; colour is never the only
  encoding; the campaign builder is fully keyboard-navigable.
- **Visual** — dashboard across themes and locales, including Japanese number and currency formatting
  in charts.

## 9. Security

- OAuth uses the backend-issued signed `state`. The frontend never handles an ad platform token.
- Ad account changes require step-up authentication — this is money-adjacent.
- No PII in chart payloads or exports beyond what the tenant already holds; export is
  permission-gated.
- Conversion diagnostics display hashed identifiers only, never raw customer data.
- A tenant-added third-party pixel loads only through the phase-05 consent-gated loader.

## 10. Phase acceptance criteria

- [ ] A tenant connects Google Ads and Meta, creates a campaign, and sees it live on the platform.
- [ ] The dashboard shows spend, conversions, revenue, and ROAS with both attribution sources
      labelled and a methodology explanation available.
- [ ] Recent-day restatement is visibly flagged rather than silently wrong.
- [ ] Tracking diagnostics correctly explain a consent-suppressed conversion and an opt-out-suppressed
      one, naming the purpose and the signal source.
- [ ] A campaign changed natively appears as drifted with a diff and an explicit resolution choice.
- [ ] Budget threshold alerts fire and auto-pause behaves exactly as the UI described.

## 11. Risks

| Risk | Mitigation |
|---|---|
| **Phase-09 frontend backlog delays phase 10 (active)** | Escalate sequencing now; 10.0–10.3 can be built against the exported capability-matrix fixtures in parallel with 09.1–09.7 |
| Numbers disagree with the native platform UI | Methodology explainer, restatement flags, timezone clarity, diagnostics showing the actual pipeline |
| The builder cannot express what an advanced user wants | Deep link to the native tool for advanced editing; drift handling makes that safe |
| Chart complexity balloons the bundle | Small tokenized chart layer, lazy-loaded dashboard route, enforced budget |
| Tenants overspend through our UI | Caps, alerts, auto-pause, change log, confirmation on budget increases above a threshold |
| Platform UI/API changes break the builder | Capability matrices are backend-provided data — a platform change is a data update, not a frontend release |
