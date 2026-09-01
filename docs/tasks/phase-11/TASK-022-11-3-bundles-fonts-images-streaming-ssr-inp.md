# TASK-022: 11.3 Bundles, fonts, images, streaming SSR & long tasks

**Phase:** 11 · **Status:** todo · **Size:** L
**Requirement(s):** FR-1107, FR-1108, FR-1109, FR-1110, NFR-1101, NFR-1102
**Depends on:** TASK-021, **phases 09 and 10 shipped**
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Blocked by (cross-repo):** sanvi-backend TASK-022 (SSR response cache, cache headers, compression)
**Gate:** bundle and Lighthouse budgets become **blocking** in this task

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Hit the lab targets on the pinned throttled profiles — **including the Japanese storefront**, which is
the hard case and therefore the case the targets are set by — and make the budgets blocking so the
result cannot silently erode.

## Why this shape

The original targets were field p75s in RUM over a week. There is no traffic, so they are now measured
on TASK-031's pinned profiles and labelled lab everywhere they appear. One consequence has to be said
plainly rather than papered over: **INP is a field metric and cannot be measured in a lab.** Total
Blocking Time is the standard proxy and is what the gate asserts. Writing "INP ≤ 200 ms" over a TBT
measurement is exactly the claim this phase exists to stop making.

The work queue is `docs/perf/worst-ten.md` from TASK-019, plus the client-side dispositions from
TASK-021's audit.

This task unblocks TASK-027, and the ordering is not negotiable: performance work moves DOM around —
lazy boundaries, streaming order, deferred hydration — so remediating focus order and live-region
behaviour before it lands means auditing twice, and the second audit is the one that gets skipped.

## Constraints

- **Budgets stay blocking regardless of what is reverted.** A reverted optimisation that leaves the
  gate green is a gate measuring nothing.
- Nothing this task renders may depend on a per-user detail leaking into a cacheable anonymous response
  — the backend's SSR cache is keyed by tenant, locale, theme revision, and device class only.
- **The Japanese font is the whole difficulty.** Any optimisation validated only against the English
  storefront has validated the easy case.
- A prefetch that fires on a throttled connection is a regression dressed as an optimisation.

## File ownership map

- every app's route definitions — splitting boundaries, streaming, deferred hydration
- `packages/ui/**` — image component with dimensions and priority hints, prefetch primitives
- font pipeline and per-locale subsets, `packages/i18n` font metadata
- third-party script loaders and their directive gates
- bundle budget config and `lighthouserc.cjs` — now blocking
- `benchmarks/frontend/rc.4.json`

## Steps

### Step 1: Audit the bundles per app

**Files:** Modify each app's build config; Modify budget config

**Do:** duplicate dependencies (**one date library, not three**), oversized imports, barrel-file bloat,
and the real per-route chunk graph. Work the worst-ten list, not intuition.

**Verify:** `pnpm check:budget --report-only` shows the per-route graph; each removed duplicate is
listed in the PR with its saved bytes.

### Step 2: Split routes and prefetch on intent

**Files:** Modify each app's route definitions; Modify `packages/ui/**`

**Do:** route-level code splitting; prefetch on hover, focus, and viewport for likely navigations,
respecting Save-Data and slow connections. Resolve the client-side entries from TASK-021's audit here.

**Verify:** a test proves prefetch does **not** fire under Save-Data or on a slow connection.

### Step 3: Finish the font strategy

**Files:** Modify the font pipeline, `packages/i18n` font metadata

**Do:** per-locale subsetting with `unicode-range`, preload only what the negotiated locale needs, and a
metric-compatible fallback so the swap does not shift layout. **Budget and report the Japanese font
separately** — a single global font number hides the only case that is hard.

**Verify:** a visual test catches font-swap shift on the Japanese storefront; the Japanese budget is
reported as its own line.

### Step 4: Fix the image pipeline

**Files:** Modify `packages/ui/**`, every image call site

**Do:** responsive `srcset`, modern formats, **explicit dimensions on every image and embed** (CLS),
lazy-loading below the fold, `fetchpriority` on the largest above-the-fold element.

**Verify:** a test asserts every image and embed has explicit dimensions; CLS is inside budget on every
app.

### Step 5: Stream and defer hydration where it helps

**Files:** Modify each app's route definitions

**Do:** stream where it improves first paint; defer hydration of below-the-fold islands; keep the
interaction-ready moment measured rather than assumed.

**Verify:** the harness records first paint and interaction-ready before and after; both are committed.

### Step 6: Audit every third-party script in both consent modes

**Files:** Modify third-party script loaders and their directive gates

**Do:** every remaining third-party script justified, deferred, and directive-gated. **A script that
only loads correctly in one consent mode is a privacy bug and a performance bug at once.**

**Verify:** an e2e **per mode** asserts zero third-party requests before a permitting directive exists —
one for EU opt-in, one for US notice-and-opt-out.

### Step 7: Profile long tasks on the pinned profiles

**Files:** Modify wherever the offenders are

**Do:** long-task profiling on the pinned mid-range Android and iOS Safari profiles; fix the top
offenders — usually hydration bursts, oversized reactive updates, and synchronous storage access.

**Verify:** Total Blocking Time is inside budget on both profiles; each fix records its before/after.

### Step 8: Turn the gates blocking

**Files:** Modify `.github/workflows/**`, budget config, `lighthouserc.cjs`

**Do:** bundle budgets and Lighthouse CI block, per app and per route, per locale, compared against the
stored baseline.

**Verify:** the bundle gate **blocks a deliberately fattened route** — proven in the PR — then passes on
the clean build.

## Definition of done

- [ ] Lab LCP ≤ 2.0 s, TBT ≤ 200 ms, CLS ≤ 0.1 on the pinned mobile profile for **both** locales.
- [ ] Storefront initial JS ≤ 100 KB gzip; admin ≤ 250 KB gzip; every route inside its own budget.
- [ ] Lighthouse mobile storefront ≥ 95 performance, ≥ 95 SEO, 100 best practices.
- [ ] Bundle and Lighthouse gates are blocking, and the bundle gate blocked a fattened route.
- [ ] Every image and embed has explicit dimensions; a visual test catches Japanese font-swap shift.
- [ ] Zero third-party requests before a permitting directive exists, proven by an e2e **per consent
      mode**.
- [ ] Prefetch does not fire under Save-Data or on a slow connection.
- [ ] Japanese page budgets are reported separately and met.
- [ ] A throttled run of the critical journeys stays inside the budgets.
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
pnpm bench:compare rc.1 rc.4
```

## Out of scope

The SSR cache itself, cache headers, and compression (backend TASK-022). Accessibility remediation
(TASK-027) — **this task must not "fix" a focus order in passing**, because a DOM change there restarts
that audit. The full slow-network and offline e2e suite (TASK-023); this task runs the critical
journeys only.

## Parked

Field p75s over a week on the new build, real mid-range device testing, and CDN image transforms with
size caps for tenant uploads — see [`../../release/needs-humans.md`](../../release/needs-humans.md).

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
