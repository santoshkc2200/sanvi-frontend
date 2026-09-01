# TASK-031: 11.a CI harness truth & pinned profiles

**Phase:** 11 · **Status:** todo · **Size:** M
**Requirement(s):** FR-1102, FR-1103, NFR-1107
**Depends on:** nothing — startable today, independent of phases 09 and 10
**Created:** 2026-09-01
**Flag:** none — CI only

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Create the three CI harnesses this whole phase's acceptance criteria are written against, and pin the
profiles that make their output comparable at all. All three run **reporting-only**; they start
blocking in TASK-022 (budgets, Lighthouse) and TASK-027 (axe).

## Why this shape

None of the three exist. There is no `lighthouserc` in the repository, no `benchmarks/` directory, and
no axe job. `check:budget` is wired into `check:all` and into `turbo.json`, but nothing behind it
defines a per-route budget — so the gate that every later task cites as its exit condition currently
measures nothing.

This task is first because every later frontend task's acceptance criterion is a number one of these
three produces. It is in the gate half because it enumerates: routes added by phases 09 and 10 get
budgeted and swept as they land, and a budget gate created **before** the bundles are fat is worth far
more than one created after, when the only available action is to raise the threshold.

The pinned profiles matter as much as the harnesses. A number from this build and a number from a build
nine tasks later are only comparable if the throttling, the browser version, and the machine profile
are identical — otherwise the phase's central claim degrades into an argument about the runner.

## Constraints

- **Reporting-only.** Nothing added here blocks a build. A gate switched on before a baseline exists is
  a gate someone disables in week one.
- Pin the Lighthouse and Chrome versions explicitly. A runner upgrade must be a deliberate commit, not
  a silent drift that invalidates every stored artifact.
- Every artifact records its profile. Two artifacts with different profiles are never compared; the
  comparison tool refuses.

## File ownership map

- `lighthouserc.cjs` and per-app overrides — Lighthouse CI configuration
- `packages/lint-gates/src/check-budget.mjs` — per-app and per-route budget enforcement
- `scripts/check-a11y.mjs` — the axe sweep and its route-coverage assertion
- `scripts/perf-profiles.json` — pinned throttling and device profiles
- `scripts/bench-compare.mjs`, `benchmarks/frontend/**` — comparison tool and artifacts
- `package.json`, `turbo.json`, `.github/workflows/**` — script wiring and reporting-only jobs

## Steps

### Step 1: Pin the profiles before anything measures

**Files:** Create `scripts/perf-profiles.json`

**Do:** define the throttling and device profiles every harness uses — a mid-range Android profile
(CPU slowdown multiplier, network shape) and an iOS Safari profile — plus the pinned Lighthouse and
Chrome versions. Record in the file that these are **emulation**, not devices, and that INP is not
measurable here (Total Blocking Time is the proxy the gates assert).

**Verify:** the file exists, every profile has an explicit version pin, and a unit test asserts no
harness reads a profile value that is not in this file.

### Step 2: Give `check:budget` something to check

**Files:** Modify `packages/lint-gates/src/check-budget.mjs`; Create per-app budget config

**Do:** per-app **and per-route** gzip budgets. Per-route matters because an app total inside budget
can hide one route that is four times its share, and that route is somebody's landing page.

Start with budgets derived from the current build plus a small margin, so the gate is meaningful
immediately; TASK-022 tightens them to the targets.

**Verify:** `pnpm check:budget --report-only` emits a per-app and per-route table. Fatten one route
deliberately and confirm the report shows it exceeding — then revert.

### Step 3: Add Lighthouse CI per app per locale

**Files:** Create `lighthouserc.cjs`; Modify `package.json`, `turbo.json`

**Do:** configure Lighthouse CI to run per app per locale on the pinned profile, with the number of
runs set so the median is stable.

**Verify:** `pnpm check:lighthouse --report-only` produces a report per app per locale. Then run it
three times on the **same build** and record the run-to-run variance. **If the variance exceeds the
threshold TASK-022 will gate on, the threshold is wrong — fix it here** rather than fighting noise for
the rest of the phase.

### Step 4: Add the axe sweep with route coverage asserted

**Files:** Create `scripts/check-a11y.mjs`; Modify `package.json`, `turbo.json`

**Do:** axe across every route of all four apps in both locales. Alongside the findings, assert
**route coverage**: enumerate routes from each app's route definitions and report any route with no
axe entry. That assertion is what makes the gate survive phases 09 and 10 adding routes.

**Verify:** `pnpm check:a11y --report-only` reports findings by severity and lists uncovered routes.
Add a throwaway route with no entry and confirm it appears as uncovered.

### Step 5: Commit the first baseline and the comparison tool

**Files:** Create `scripts/bench-compare.mjs`, `benchmarks/frontend/baseline.json`

**Do:** one full run of all three harnesses across four apps × two locales, committed as the baseline
with the profile block embedded. `bench-compare` diffs two artifacts per metric and refuses to compare
artifacts with different profiles.

**Verify:**
- `pnpm bench:compare baseline baseline` → passes.
- Inject a 20 % regression into a copy → fails.
- Two artifacts with different profiles → refuses rather than reporting a difference.

### Step 6: Wire all three into CI, reporting-only

**Files:** Modify `.github/workflows/**`, `package.json`

**Do:** three jobs that run and report. None block. Add `check:a11y` and `check:lighthouse` to the
script surface alongside the existing `check:budget`.

**Verify:** a PR shows all three reports; a deliberately regressed PR shows the regression in the
report and still merges — which is the intended behaviour at this stage.

## Definition of done

- [ ] `scripts/perf-profiles.json` pins device, throttling, Lighthouse, and Chrome versions, and no
      harness reads a profile value from anywhere else.
- [ ] `pnpm check:budget --report-only` reports per app **and per route**, and shows a deliberately
      fattened route as over.
- [ ] `pnpm check:lighthouse --report-only` runs per app per locale, and its measured run-to-run
      variance on a fixed build is inside the threshold TASK-022 will gate on.
- [ ] `pnpm check:a11y --report-only` reports by severity and lists routes with no axe entry.
- [ ] `benchmarks/frontend/baseline.json` is committed with an embedded profile block.
- [ ] `pnpm bench:compare` fails on an injected 20 % regression and refuses cross-profile comparison.
- [ ] All three harnesses run in CI, reporting-only, and none block.
- [ ] `pnpm check:all` is green.

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
pnpm bench:compare baseline baseline
```

## Out of scope

Any optimisation (TASK-022) or remediation (TASK-027). Turning any gate blocking. The telemetry package
and release stamping (TASK-019).

## Parked

Real mid-range Android and iOS device testing — the profiles here are emulation, and that substitution
is recorded in [`../../release/needs-humans.md`](../../release/needs-humans.md).

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
