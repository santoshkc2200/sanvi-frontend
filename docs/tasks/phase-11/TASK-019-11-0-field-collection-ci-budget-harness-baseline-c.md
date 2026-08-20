# TASK-019: 11.0 Field collection, CI budget harness & baseline capture

**Phase:** 11
**Status:** todo
**Requirement(s):** FR-1101, FR-1102, FR-1103, NFR-1104, NFR-1107
**Depends on:** phase 10
**Created:** 2026-08-21

**Blocked by (cross-repo):** sanvi-backend TASK-019 (`GET /api/v1/system/build`)
**Slice:** 11.0 — Feature freeze, production-shaped baseline & the measurement harness
**Prerelease:** `v1.0.0-rc.1` · **Flag:** none — this task ships tooling, not behaviour

## Context

Phase 11 is judged in numbers, and the frontend's numbers take four weeks to accrue. Everything here
exists so that TASK-022 opens with real field p75s and a work queue chosen from data rather than
intuition — which means this task is on the critical path for a calendar reason, not a technical one.

Nothing user-visible ships and nothing gets faster. **A gate switched on before a baseline exists is a
gate someone disables in week one**, so all three harnesses run reporting-only here and start blocking
in TASK-022 and TASK-027.

## What to do

- [ ] **Contract** — consume `GET /api/v1/system/build` (commit sha, semver, built-at, environment) from
      the backend's TASK-019. Every app build embeds the same identity and passes it to the error tracker
      and RUM as the release tag, so a field measurement can always be attributed to an exact build.
- [ ] **Field collection on** — RUM (Core Web Vitals plus navigation and resource timing) enabled in
      staging and beta **today**, so TASK-022 opens with four weeks of real p75s instead of lab guesses.
      Sampling, directive gating (this is telemetry: it goes through the phase-05 resolver like
      everything else), and PII scrubbing are configured here, not later.
- [ ] **CI budget harness** — per-app **and per-route** bundle budgets, Lighthouse CI configured per app
      per locale, and an axe sweep job. All three run **reporting-only** in this task.
- [ ] **Comparable device profiles** — pinned throttling profiles for mid-range Android and iOS Safari,
      plus a pinned Lighthouse/Chrome version, so a number from `rc.1` can be compared with a number from
      `rc.9` without arguing about the runner.
- [ ] **Baseline capture** — first full run of all three harnesses across the four apps × two locales,
      committed as `benchmarks/frontend/rc.1.json`, **with the worst ten routes per app listed**.
      TASK-022's scope is chosen from this list.

## Acceptance criteria

- [ ] RUM is collecting in staging and beta, with sampling, directive gating, and PII scrubbing
      configured at the point collection starts.
- [ ] RUM payloads contain no PII and no full URLs with query strings, and are **suppressed entirely**
      when the directive resolver says no.
- [ ] Every app build reports the same sha `GET /api/v1/system/build` returns, asserted in an e2e.
- [ ] Bundle budgets (per app and per route), Lighthouse CI (per app per locale), and the axe sweep all
      run in CI and report — none of them block yet.
- [ ] Lighthouse run-to-run variance on a fixed build is inside the threshold the gate will use in
      TASK-022. **If it is not, the threshold is wrong** — fix it here rather than fighting noise later.
- [ ] Device and browser profiles are pinned and version-locked; a runner upgrade is a deliberate commit.
- [ ] `benchmarks/frontend/rc.1.json` is committed with the worst ten routes per app listed.
- [ ] No behaviour change: `pnpm check:all` and the full e2e suite are green, and no benchmark moved.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:all
pnpm check:budget --report-only
pnpm check:lighthouse --report-only
pnpm check:a11y --report-only
pnpm test:e2e
```

## Out of scope

Any optimisation at all (TASK-022), any remediation (TASK-027), turning any of the three gates from
reporting-only to blocking, and the error tracker itself (TASK-020 — this task only reserves the release
tag it will use).

## Files likely touched

- `packages/telemetry/**` (new: RUM collector, sampling, directive gate, scrubbing)
- `packages/api-client/**` (build probe)
- each app's build config (release stamping from the build identity)
- `lighthouserc.*`, bundle budget config per app and route, axe sweep job
- `benchmarks/frontend/rc.1.json`, device profile definitions
- CI workflow definitions (three reporting-only jobs)

## Notes / gotchas

- Rollback: nothing to unwind. Collection is directive-gated and sampled; the harnesses are CI-only.
- RUM is telemetry, and telemetry is a purpose. It goes through the phase-05 resolver like every other
  purpose — including the US notice-and-opt-out mode, not only the EU opt-in one. Getting this wrong here
  means four weeks of data that has to be thrown away.
- The worst-ten-routes list is the deliverable that matters most. TASK-022 is scoped from it, so a list
  produced from a lab run rather than from field data sends the whole optimisation slice to the wrong
  routes.

---
*On completion: satisfy every acceptance criterion, run the verification commands,
then record status with the sdlc-planner script (never by hand-editing this line
and the backlog separately):*
`sdlc.py status TASK-019 done --note "<PR or commit>"`
