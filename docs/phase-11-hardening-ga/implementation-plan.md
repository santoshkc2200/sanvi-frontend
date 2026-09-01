# Phase 11 — Performance, Accessibility & GA (frontend)

**Target version:** 1.0.0
**Depends on:** frontend 00–10 for the GA-gated half; **nothing** for the gate half
**Unlocks:** general availability

**Sliced into thirteen tasks in [`../tasks/phase-11/README.md`](../tasks/phase-11/README.md)**, which
is authoritative for order, slicing, and each slice's exit criteria. This plan stays authoritative for
*what* and *why*. Requirements are numbered `FR-11xx` / `NFR-11xx` in
[`../requirements.md`](../requirements.md). Everything cut from this phase for want of a second person,
a vendor, a device, or traffic is recorded in
[`../release/needs-humans.md`](../release/needs-humans.md) with what unblocks it.

## Read this first: the frontend is two phases behind

Frontend phase 09 is 3/8 done (TASK-004 through TASK-008 are open) and **phase 10 has not started**.
Backend phase 10 is nearly complete, so the backend is roughly two phases ahead.

That means most of this phase is unreachable, and it is worth being blunt about the consequence:
**frontend phases 09 and 10 are the project's actual critical path, not phase 11.** The GA-gated half
of this plan cannot start, and no amount of resequencing changes that — the screens it hardens do not
exist yet.

What *can* start is the gate half: the CI harnesses, the telemetry package, and the security gates.
Those enumerate rather than audit, so they cover phases 09 and 10 as those land, and they are worth
more the earlier they exist. A budget gate added after the bundles are already fat is a gate someone
raises the threshold on.

## Goal

Make the frontend fast on the devices and networks users actually have, usable by people who do not use
a mouse or a screen, observable when it breaks, and honest when the backend is having a bad day.

## The one invariant, restated honestly

The original plan's invariant was **field data decides**. There is no field. The replacement:

**Measurements are comparable or they are worthless.** Pinned throttling profiles, a pinned browser
version, committed baseline artifacts, and a comparison that fails on regression. Every number this
phase produces is a **lab** number and says so. They are excellent at catching a regression between two
builds and they do not tell you what a real user on a real mid-range phone experiences.

The corollary that shapes the rewrite: **an acceptance criterion that cannot be falsified by running a
command is not an acceptance criterion.** Criteria that depended on a vendor report, a device lab, a
second person, or a week of RUM were removed from the task graph rather than left to be quietly ticked.

Three invariants survive unchanged, because they never needed traffic:

- **An absence is never rendered as a zero.** Stale content says what is stale, a degraded response
  says it is degraded, an archived range says it is archived, a tenant under restore is told so. Every
  async surface has loading, empty, error, and success states and a timeout — audited route by route,
  not asserted (NFR-1105).
- **Baseline first, gate second.** The harnesses run reporting-only until there is a baseline to gate
  against. A gate switched on before a baseline exists is a gate someone disables in week one
  (NFR-1107).
- **No new features.** The single exception is TASK-026's usage and quota surfaces, because a limit
  users cannot see is a support ticket with extra steps (NFR-1106).

## The phase splits in two

**Gate half — startable today, independent of phases 09 and 10.**
CI harness truth, the measurement harness and telemetry package, error tracking and diagnostics, and
the security gates. Tasks: 031, 019, 020, 024.

**GA half — needs phases 09 and 10 shipped.**
Everything that hardens a screen: performance work, outage UX, status surfaces, quota surfaces,
accessibility, offboarding, privacy re-verification, and the release. Tasks: 021, 022, 023, 025, 026,
027, 028, 029, 030.

## Targets (lab, not field)

| Metric | Target | Where measured |
|---|---|---|
| Storefront LCP | ≤ 2.0 s | Lighthouse CI, pinned mobile profile |
| Storefront INP proxy (Total Blocking Time) | ≤ 200 ms | Lighthouse CI, pinned mobile profile |
| CLS | ≤ 0.1 | Lighthouse CI |
| Storefront JS (gzip, initial) | ≤ 100 KB | CI budget |
| Admin JS (gzip, initial) | ≤ 250 KB | CI budget |
| Lighthouse (storefront, mobile) | ≥ 95 performance, 100 a11y, 100 best practices, ≥ 95 SEO | CI |
| Axe serious/critical issues | 0 | CI, blocking from TASK-027 |
| Japanese storefront | reported separately, same targets | CI budget + Lighthouse |

INP is a field metric and cannot be measured in a lab; Total Blocking Time is the standard proxy and is
what the gate actually asserts. Saying "INP ≤ 200 ms" when TBT is what was measured is the kind of
claim this phase exists to stop making.

**The Japanese storefront is the whole difficulty.** A single global font number hides the only case
that is hard, so it is budgeted and reported separately, and any optimisation validated only against
the English storefront has validated the easy case.

## Work breakdown

### 1. CI harness truth (TASK-031)

None of the three harnesses this phase depends on exist: there is no `lighthouserc`, no committed
`benchmarks/`, and no axe job. `check:budget` is wired into `check:all` but has no per-route budgets
behind it. This task creates all three, running reporting-only, plus the pinned profiles that make
their output comparable at all.

It is first because every later frontend task's acceptance criterion is a number from one of them.

### 2. Telemetry package and baseline (TASK-019)

`packages/telemetry` as a new package: a Core Web Vitals and resource-timing collector, sampled, PII-
scrubbed, and **gated through the phase-05 directive resolver like any other purpose** — including the
US notice-and-opt-out mode, not only the EU opt-in one. It is built now and switched on when there is
traffic, because retrofitting consent gating onto a collector already shipping is how four weeks of
data becomes four weeks of data that has to be thrown away.

Release stamping from the backend's `GET /api/v1/system/build`, so every measurement and every error
report names an exact build. The first full harness run committed as the baseline, with the worst ten
routes per app listed — the work queue TASK-022 is scoped from.

### 3. Error tracking and diagnostics (TASK-020)

Source maps uploaded privately and **never served** — uploaded and *also* served is the default of most
bundler integrations, and the test that asserts they are unreachable is the one that catches it. The
backend's `traceparent` and `trace_id` consumed so a field incident can be traced across the repo
boundary in under a minute: a slow page is either a slow query or a heavy bundle, and the trace id is
the only thing that tells you which. Every error screen shows a trace id, and one "copy diagnostics"
action produces one paste — a support flow that asks the user to read a trace id aloud loses a
character and an afternoon.

### 4. Security gates (TASK-024)

Mostly subtraction. Phases 07–10 each widened the CSP a little for a legitimate reason, and the
accumulated result is a policy that no longer says much. Remove the widenings, **report-only first**,
because a widening removed without checking what used it is an outage. Auth surface re-review: nothing
sensitive in `localStorage`, logout complete across tabs, CSRF posture on every non-GET, OAuth handoffs
rejecting redirect injection. Extend the phase-10 build-output secret scan to every app and every
secret class, blocking — and prove it fails on a *planted* credential per class, because a scan that
has never caught anything is a scan nobody has tested.

### 5. Harness re-run and call-pattern audit (TASK-021)

Deliberately small; its value is that it happens at all. Re-run the harness after the backend's
performance slice, and walk the frontend's call sites for endpoints called in a loop, per-row, or once
per rendered item. **An N+1 is often a client pattern** — a projection built to serve a loop the client
should not be running is a permanent cost paid to avoid a one-line fix. The audit is only useful
*before* the backend decides which projections to build.

### 6. Performance (TASK-022)

Bundle audit per app: duplicate dependencies (one date library, not three), oversized imports,
barrel-file bloat, the real per-route chunk graph. Budgets become blocking here. Route splitting and
prefetch on intent, respecting Save-Data — a prefetch that fires on a throttled connection is a
regression dressed as an optimisation. Font subsetting per locale with `unicode-range` and a
metric-compatible fallback so the swap does not shift layout. Images with explicit dimensions
everywhere, `fetchpriority` on the largest above-the-fold element, lazy-loading below the fold.
Streaming SSR and deferred hydration where they help. Every third-party script justified, deferred, and
directive-gated, **re-verified in both consent modes** — a script that only loads correctly in one mode
is a privacy bug and a performance bug at once.

### 7. Resilience (TASK-023)

The backend decides what the system *does* when a dependency fails; this decides what the user *sees*,
and the bar is a designed experience rather than an incidental toast on a blank panel. **Nothing spins
forever**: every async surface gets a timeout and a terminal state, and the route-by-route audit that
produces that list is a deliverable, reused as TASK-027's route inventory. **Honesty over reassurance**:
a degraded response says it is degraded, stale content says what is stale, and a non-idempotent action
that might have succeeded asks rather than silently retrying. Offline queueing only for actions that
can be made idempotent — if one cannot, it is not queueable, and saying so is better than queueing it
and hoping.

### 8. Status surfaces (TASK-025)

The public face of the backend's recovery work, with one rule: **the page tells the truth from the same
signal the operators are acting on**, never from a separate manual toggle someone forgets to flip back.
Both locales, because a status page that only speaks English fails half the users during the one event
they need it, and incident templates written before the incident rather than under pressure. The
restore-in-progress state exists for a specific failure: during a single-tenant restore that tenant's
admin would otherwise render an empty dataset, and an empty dataset reads as data loss.

### 9. Quota surfaces (TASK-026)

**The phase's single permitted new capability.** `429` handled once in `packages/api-client` rather
than per app, because four apps each getting backoff subtly wrong is four bug reports with one root
cause, and `429` and `503` get different backoff and different copy. Usage against limit per metered
dimension, with a warning threshold before the wall — and **the number shown must be the number
enforcement uses**, because a UI showing a different number from the one that blocks the request is
worse than no UI. Regenerating the client from the frozen spec is also the proof the backend's
consistency pass worked: every hand-written workaround that can now be deleted is one inconsistency
that is really gone.

### 10. Accessibility (TASK-027)

Axe blocking across every route × locale × theme, with route coverage asserted so a new route with no
axe entry fails. Keyboard-only e2e completing the critical journeys without a mouse. Focus management
on dialogs, drawers, route changes, async results, and above all the phase 08–10 wizards. Forms with
programmatic labels, associated errors, and a linked error summary; no colour-only status anywhere.
Charts with a data table alternative, a text summary, and non-colour encodings — the ROAS dashboard is
the densest surface in the product and therefore the one most likely to fail. Contrast gates re-run
against **real published themes**, not the default token set, because the default set proves nothing
about the population that matters.

It depends on the performance work for a reason that is easy to get backwards: performance work moves
DOM around — lazy boundaries, streaming order, deferred hydration — so auditing before that lands means
auditing twice, and the second audit is the one that gets skipped.

### 11. Data-lifecycle surfaces (TASK-028)

Offboarding, retention reporting, and archived-range messaging, unified by the absence rule. The
archived-range case is its sharpest version: a tenant querying metrics from an archived period would
otherwise see an empty chart, and an empty chart says "you did nothing that month" rather than "that
month is archived, here is how to get it back". Build it as a variant of the existing empty state so
every surface that already handles empty inherits it instead of forgetting it.

### 12. Privacy re-verification (TASK-029)

Phase 05 built the privacy surfaces; phases 08, 09, and 10 changed the system underneath them. Custom
domains, tenant payments, and the tracking endpoint all arrived after the privacy centre did. The
GPC-on-a-custom-domain case is the one most likely to be quietly broken, because the signal arrives on
the tenant's own domain — a code path phase 05 never saw.

### 13. Release readiness (TASK-030)

E2E completion across every phase's critical journeys, the browser matrix actually run rather than
assumed from a "modern browsers" claim, zero known flakes with quarantine **visible in the run output**
— a quarantined flake nobody can see is a disabled test with better branding — and a stable visual
regression baseline with diffs reviewed rather than auto-accepted.

## Testing

- Full e2e suite green on the local browser matrix, with slow-network and offline variants.
- Lighthouse CI on representative pages per app per locale, blocking on regression.
- Axe sweep with zero serious/critical, blocking, with route coverage asserted.
- Bundle budgets per app *and* per route, blocking.
- Visual regression baseline stable across two consecutive runs on the same build.

## Acceptance criteria

- [ ] All three CI harnesses exist, are pinned, and produce comparable artifacts.
- [ ] Every app build reports the same sha `GET /api/v1/system/build` returns.
- [ ] Source maps resolve in the tracker and are unreachable from any public URL.
- [ ] Every error screen shows a trace id; one action produces one diagnostics paste.
- [ ] No phase 07–10 CSP widening remains; the secret scan blocks and catches a planted credential.
- [ ] Lab targets met on pinned profiles, with the Japanese storefront reported separately.
- [ ] Every async surface has loading, empty, error, and success states — audited route by route.
- [ ] A simulated backend outage produces a designed, honest experience in all four apps.
- [ ] Zero serious/critical axe findings, gate blocking, route coverage asserted.
- [ ] Keyboard-only e2e completes the critical journeys.
- [ ] Contrast holds over real published themes; a failing theme is rejected at publish.
- [ ] The usage number shown equals the number enforcement uses.
- [ ] An archived range renders as archived, never as an empty chart.
- [ ] Zero known flakes; quarantine visible in the run output.
- [ ] The accessibility statement describes the method tested and names the missing external audit.

## Risks

| Risk | Mitigation |
|---|---|
| Lab numbers get mistaken for field numbers | Every artifact records its profile; every target table says lab; INP is named as a TBT proxy rather than as INP |
| Japanese font weight prevents hitting the LCP target | Per-locale subsetting, locale-conditional preload, metric-compatible fallback, and a separately reported Japanese budget |
| Accessibility debt across ten phases surfaces at once | a11y contracts have been lint-enforced since phase 00, so this phase audits and polishes; where that turns out optimistic, the finding becomes a lint gap and the gate is strengthened |
| No external audit means AA is asserted rather than verified | The statement describes the method rather than claiming conformance, and names the gap |
| Flaky e2e erodes trust in the gate | Quarantine with a deadline, visible in run output, deterministic test data |
| Performance work regresses features or a11y | Full e2e and visual regression on every optimisation PR; TASK-027 runs after TASK-022, never alongside |
| The gate half lands and phases 09–10 then skip it | The gates are CI-blocking, so phase 09 and 10 work cannot merge without satisfying them |
