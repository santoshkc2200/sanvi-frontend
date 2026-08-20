# Phase 11 — Performance, Accessibility & GA (frontend)

**Target version:** 1.0.0
**Depends on:** frontend 00–10
**Unlocks:** general availability

**Sliced into twelve tasks in [`../tasks/phase-11/README.md`](../tasks/phase-11/README.md)**, which is
authoritative for order, slicing, and each slice's exit criteria. This plan stays authoritative for
*what* and *why*. Requirements are numbered `FR-11xx` / `NFR-11xx` in
[`../requirements.md`](../requirements.md).

## Goal

Make the frontend fast on the devices and networks our users actually have, usable by people who do
not use a mouse or a screen, observable when it breaks in the field, and resilient when the backend
is having a bad day.

## Scope

**In**
- Performance: Core Web Vitals in the field, bundle and font discipline, image strategy, caching.
- Accessibility: WCAG 2.2 AA audit and remediation across all four apps, including an external audit.
- Frontend observability: error tracking, RUM, session diagnostics, release health.
- Resilience: offline/degraded behaviour, retry UX, error boundaries, backend-outage experience.
- Cross-browser/device matrix, e2e suite completion, and the release process.
- SEO completion for storefront and marketing.

**Out**
- New features. Everything here improves what exists.

## Targets

| Metric | Target | Where measured |
|---|---|---|
| Storefront LCP (p75, mobile, field) | ≤ 2.0 s | RUM |
| Storefront INP (p75) | ≤ 200 ms | RUM |
| CLS (p75) | ≤ 0.1 | RUM |
| Storefront JS (gzip, initial) | ≤ 100 KB | CI budget |
| Admin JS (gzip, initial) | ≤ 250 KB | CI budget |
| Lighthouse (storefront, mobile) | ≥ 95 performance, 100 a11y, 100 best practices, ≥ 95 SEO | CI |
| Axe serious/critical issues | 0 | CI + manual audit |
| Uncaught error rate | < 0.1 % of sessions | Error tracker |

Field data (RUM), not lab data, is the number that counts; Lighthouse is the regression guard.

## Work breakdown

### 1. Performance
- Bundle audit per app: duplicate dependencies, oversized imports, barrel-file bloat, moment-of-truth
  route chunks; enforce per-route budgets, not just app totals.
- Route-level code splitting review; prefetch on intent (hover/focus/viewport) for likely navigations.
- Font strategy final pass: subsetting per locale, `unicode-range`, preload only what the negotiated
  locale needs, and a metric-compatible fallback so swapping does not shift layout.
- Image pipeline: responsive `srcset`, modern formats, explicit dimensions everywhere (CLS),
  lazy-loading below the fold, priority hints for the LCP element, and CDN transforms for tenant
  uploads.
- Caching: immutable hashed assets, sensible HTML cache headers per app, SSR response caching for
  anonymous storefront pages keyed by (tenant, locale, theme revision).
- Streaming SSR where it helps first paint; defer non-critical hydration.
- Third-party audit: every remaining third-party script justified, deferred, and directive-gated —
  re-verified in both the opt-in and the US notice-and-opt-out modes.
- Long-task profiling on mid-range Android and Safari iOS; fix the top INP offenders.

### 2. Accessibility
- Full WCAG 2.2 AA audit per app; automated axe sweep plus manual keyboard, screen reader
  (NVDA/JAWS/VoiceOver), zoom to 400 %, and reduced-motion passes.
- Focus management review: dialogs, drawers, route changes, async results, and the wizards from
  phases 08–10, which are the highest-risk surfaces.
- Forms: programmatic labels, error association, error summaries with skip links, and no colour-only
  status anywhere.
- Charts (phase 10): accessible data tables, text summaries, and non-colour encodings.
- Theming interaction: verify that tenant themes cannot produce a failing state — contrast gates hold
  under real published themes.
- **External accessibility audit** with remediation before GA, and a published accessibility statement.

### 3. Observability
- Error tracking with source maps (uploaded privately, not served), release tagging, and PII scrubbing
  in breadcrumbs and payloads.
- RUM: Core Web Vitals by route, tenant, locale, and device class — segmented, because an average
  hides the tenant with the huge Japanese font and the slow theme.
- Release health: error rate and vitals per release, with an automatic flag on regression.
- User-facing diagnostics: a trace id on every error screen and a "copy diagnostics" action that
  gives support everything it needs in one paste.
- Frontend logging discipline: no PII, sampled, and off by default in production.

### 4. Resilience
- Error boundaries per route with recovery actions, not a blank page.
- Backend-outage experience per app: storefront serves cached content where possible; admin explains
  and offers retry; no infinite spinners anywhere (every async state has a timeout).
- Retry UX with exponential backoff and a manual retry affordance; idempotent mutations are safe to
  retry, non-idempotent ones say so.
- Offline detection with a queue for safe actions and honest messaging for unsafe ones.
- Slow-network testing (3G throttling) as part of the e2e suite for the critical journeys.

### 5. Release readiness
- Browser/device matrix agreed and tested: latest two versions of Chrome, Safari, Firefox, Edge;
  iOS Safari and Android Chrome on mid-range devices.
- E2E suite completion: every phase's critical journeys, run against staging on every release,
  with flake tracking and a zero-tolerance flake policy.
- Visual regression baseline across themes × locales for key screens.
- Release process: versioning, changelog, staged rollout, feature-flag review (remove dead flags),
  rollback procedure rehearsed.
- Documentation: component library published, contribution guide current, runbook for frontend
  incidents, and an onboarding path a new engineer can follow unaided.

## Testing

- Full e2e suite green on the browser matrix; slow-network and offline variants for critical paths.
- Lighthouse CI on representative pages per app, per locale, blocking on regression.
- Axe sweep with zero serious/critical; manual audit findings closed.
- Load-adjacent check: storefront under CDN cache miss with a cold theme cache still meets budgets.
- Visual regression baseline approved and stable (no flaky diffs).

## Acceptance criteria

- [ ] Field Core Web Vitals meet targets at p75 for both locales, including Japanese pages.
- [ ] Zero serious/critical accessibility issues; external audit findings remediated; accessibility
      statement published.
- [ ] Every async surface has loading, empty, error, and success states — audited route by route.
- [ ] Error tracking and RUM are live with release tagging, PII scrubbing, and alerting.
- [ ] The full e2e suite passes on the agreed browser matrix with zero known flakes.
- [ ] A backend outage produces a designed, honest experience in all four apps.
- [ ] Bundle budgets hold on every app and every route.

## Risks

| Risk | Mitigation |
|---|---|
| Japanese font weight prevents hitting LCP targets | Aggressive subsetting, locale-conditional preload, metric-compatible fallback, and a measured budget per locale |
| Tenant themes and content break performance | CDN image transforms, size caps on assets, per-tenant RUM segmentation to find the outliers |
| Accessibility debt across ten phases surfaces all at once | a11y gates ran from phase 00; this phase audits and polishes rather than remediates from zero |
| Flaky e2e erodes trust in the gate | Flake tracking, quarantine with an owner and a deadline, deterministic test data |
| Performance work regresses features | Full e2e + visual regression run on every optimisation PR |
