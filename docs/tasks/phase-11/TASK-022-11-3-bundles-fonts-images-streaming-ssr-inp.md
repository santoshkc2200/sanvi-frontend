# TASK-022: 11.3 Bundles, fonts, images, streaming SSR & INP

**Phase:** 11
**Status:** todo
**Requirement(s):** FR-1107, FR-1108, FR-1109, FR-1110, NFR-1101, NFR-1102
**Depends on:** TASK-020
**Created:** 2026-08-21

**Blocked by (cross-repo):** sanvi-backend TASK-022 (SSR response cache, cache headers, compression)
**Slice:** 11.3 — Frontend performance & Core Web Vitals
**Prerelease:** `v1.0.0-rc.4` · **Flag:** `platform.ssr_cache` (backend-owned)

## Context

Hit the field targets on the devices and networks users actually have: **LCP ≤ 2.0 s, INP ≤ 200 ms,
CLS ≤ 0.1 at p75 — including Japanese pages**, which are the hard case and therefore the case the
targets are set by.

Field data decides. Lighthouse is the regression guard, not the goal: a build can score 100 in the lab
and still be slow for the tenant with a heavy theme and a CJK font, which is precisely why TASK-020's
segmentation lands first and why the work queue is TASK-019's worst-ten list rather than intuition.

This task also unblocks TASK-027, and the ordering is not negotiable: performance work moves DOM around
— lazy boundaries, streaming order, deferred hydration — so remediating focus order and live-region
behaviour before it lands means auditing twice, and the second audit is the one that gets skipped.

## What to do

- [ ] **Contract** — no `/api/v1` shape changes. Consume the backend's SSR cache semantics (keyed by
      tenant, locale, theme revision, device class) and its per-app cache headers; nothing this task
      renders may depend on a per-user detail leaking into a cacheable anonymous response.
- [ ] **Bundle audit per app** — duplicate dependencies (one date library, not three), oversized imports,
      barrel-file bloat, and the actual per-route chunk graph. **Budgets become blocking in this task**,
      per app *and per route*; the worst-ten list from TASK-019 is the work queue.
- [ ] **Route-level splitting and prefetch on intent** — hover, focus, and viewport prefetch for likely
      navigations, respecting Save-Data and slow connections. A prefetch that fires on a 3G phone is a
      regression dressed as an optimisation. Resolve the client-side entries from TASK-021's call-pattern
      audit here.
- [ ] **Font strategy final pass** — per-locale subsetting with `unicode-range`, preload only what the
      negotiated locale needs, and a metric-compatible fallback so the swap does not shift layout. **The
      Japanese font budget is measured and reported separately** — a single global font number hides the
      only case that is hard.
- [ ] **Image pipeline** — responsive `srcset`, modern formats, explicit dimensions on every image (CLS),
      lazy-loading below the fold, `fetchpriority` on the LCP element, and CDN transforms with size caps
      for tenant uploads so one tenant's 8 MB hero cannot blow the budget for their own storefront.
- [ ] **Streaming SSR and deferred hydration** — stream where it improves first paint, defer hydration of
      below-the-fold islands, and keep the interaction-ready moment measured rather than assumed.
- [ ] **Third-party audit** — every remaining third-party script justified, deferred, and
      directive-gated, re-verified in **both** the opt-in and the US notice-and-opt-out modes. A script
      that only loads correctly in one mode is a privacy bug and a performance bug at once.
- [ ] **INP work** — long-task profiling on mid-range Android and iOS Safari with TASK-019's pinned
      profiles; fix the top offenders (usually hydration bursts, oversized reactive updates, and
      synchronous storage access).
- [ ] **Per-locale budgets in CI** — Lighthouse CI runs per app per locale and blocks on regression;
      bundle budgets block; both compare against the stored `rc.1` baseline.

## Acceptance criteria

- [ ] Field p75 LCP ≤ 2.0 s, INP ≤ 200 ms, CLS ≤ 0.1 for both locales on the storefront, **measured in
      RUM over at least a week on the new build — not in Lighthouse**.
- [ ] Storefront initial JS ≤ 100 KB gzip; admin ≤ 250 KB gzip; every route inside its own budget.
- [ ] Lighthouse mobile storefront ≥ 95 performance, ≥ 95 SEO, 100 best practices.
- [ ] Bundle, Lighthouse, and per-locale budget gates are all **blocking**, and the bundle gate blocks a
      deliberately fattened route — proven in the PR.
- [ ] Every image and embed has explicit dimensions, asserted by a test; a visual test catches font-swap
      shift on the Japanese storefront.
- [ ] Every third-party script is justified, deferred, and gated, with **zero third-party requests before
      a permitting directive exists** in both consent modes, proven by an e2e per mode.
- [ ] Prefetch does not fire under Save-Data or on a slow connection, proven by a test.
- [ ] Japanese page budgets are reported separately and met.
- [ ] A slow-network (3G profile) run of the critical journeys stays inside the budgets.
- [ ] `benchmarks/frontend/rc.4.json` is committed and better than `rc.1` on every scenario, or the
      exception is explained in the PR.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:all
pnpm check:budget
pnpm check:lighthouse
pnpm test:e2e --project=slow-3g
```

## Out of scope

The SSR cache itself, cache headers, and compression (backend TASK-022). Accessibility remediation
(TASK-027) — this task must not "fix" a focus order in passing. The full slow-network and offline e2e
suite (TASK-023); this task runs the critical journeys only.

## Files likely touched

- every app's route definitions (splitting boundaries, streaming, deferred hydration)
- `packages/ui/**` (image component with dimensions and priority hints, prefetch primitives)
- font pipeline and per-locale subsets, `packages/i18n` font metadata
- third-party script loaders and their directive gates
- bundle budget config (now blocking), `lighthouserc.*` (now blocking)
- `benchmarks/frontend/rc.4.json`

## Notes / gotchas

- Rollback: frontend optimisations roll back per-commit. **Budgets stay blocking regardless**, because a
  reverted optimisation that leaves the gate green is a gate measuring nothing. The backend's
  `platform.ssr_cache` is the one flag in the slice that can serve a wrong response, and it ships last
  and alone.
- Field numbers need a week on the new build. Plan the task to land the code, then wait — the acceptance
  criterion is not satisfiable on merge day, and pretending otherwise turns the phase's core invariant
  into a formality.
- The Japanese font is the whole difficulty. Any optimisation validated only against the English
  storefront has validated the easy case.

---
*On completion: satisfy every acceptance criterion, run the verification commands,
then record status with the sdlc-planner script (never by hand-editing this line
and the backlog separately):*
`sdlc.py status TASK-022 done --note "<PR or commit>"`
