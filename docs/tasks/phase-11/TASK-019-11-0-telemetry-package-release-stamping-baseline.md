# TASK-019: 11.0 Telemetry package, release stamping & baseline

**Phase:** 11 · **Status:** todo · **Size:** M
**Requirement(s):** FR-1101, FR-1102, FR-1103, NFR-1104, NFR-1107
**Depends on:** TASK-031
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Blocked by (cross-repo):** sanvi-backend TASK-019 (`GET /api/v1/system/build`)
**Flag:** none — this task ships a package and tooling, not behaviour

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Build `packages/telemetry` — a Core Web Vitals and resource-timing collector that is sampled, PII-
scrubbed, and directive-gated — and stamp every build with the identity the backend reports, so any
measurement or error report can name the exact build that produced it. Then commit the baseline the
rest of the phase is compared against.

## Why this shape

The original task turned RUM on in staging and beta so TASK-022 would open with four weeks of real
field p75s. There is no staging traffic and no beta, so that acceptance criterion was unsatisfiable and
the work queue it was supposed to produce has to come from somewhere else.

The collector is still built now, and that is a deliberate choice rather than speculative scaffolding:
**RUM is telemetry, and telemetry is a purpose.** It goes through the phase-05 directive resolver like
every other purpose, including the US notice-and-opt-out mode, not only the EU opt-in one. Retrofitting
consent gating onto a collector that is already shipping is how a month of data becomes a month of data
that has to be thrown away. Building it gated from the first line means switching it on later is
configuration, not a project.

The worst-ten-routes list comes from TASK-031's lab harness instead of from field data. That is a real
downgrade — a lab-chosen work queue can send the optimisation slice to the wrong routes — and it is
recorded next to the list rather than glossed over.

## Constraints

- The collector emits nothing unless the directive resolver permits it. **Suppression is the default**,
  asserted by a test, not by configuration.
- No PII and no full URLs with query strings in any payload.
- No optimisation of any kind in this task.

## File ownership map

- `packages/telemetry/**` — new package: collector, sampling, directive gate, scrubbing
- `packages/api-client/**` — the build probe client
- each app's build configuration — release stamping from the build identity
- `benchmarks/frontend/rc.1.json`, `docs/perf/worst-ten.md`

## Steps

### Step 1: Consume the build probe

**Files:** Modify `packages/api-client/**`; Modify each app's build config

**Do:** read `GET /api/v1/system/build` (commit sha, semver, built-at, environment). Every app build
embeds the same identity and passes it to the collector and, in TASK-020, to the error tracker as the
release tag.

**Verify:** an e2e asserts every app build reports the same sha `GET /api/v1/system/build` returns.

### Step 2: Write the suppression tests before the collector

**Files:** Create `packages/telemetry/src/__tests__/directive-gate.test.ts`

**Do:** assert that with the resolver denying, **nothing is emitted at all** — not a reduced payload, not
a sampled one. Assert the same in both consent modes: EU opt-in and US notice-and-opt-out. Assert no
payload contains an email, a session token, or a full URL with a query string.

**Verify:** the tests compile and fail for the right reason (no collector yet).

### Step 3: Build the collector

**Files:** Create `packages/telemetry/**`

**Do:** Core Web Vitals plus navigation and resource timing. Sampling configured here, not later.
Every event carries the segmentation dimensions — route, tenant, locale, device class, theme revision —
at collection time, so that querying them later needs no client change.

**Verify:** the Step 2 tests pass. `pnpm check:boundaries` passes (the package respects the workspace's
dependency rules).

### Step 4: Leave collection off, and say why in the code

**Files:** `packages/telemetry/**`, app configuration

**Do:** the collector ships wired but not enabled — there is no collector endpoint and no traffic. The
configuration flag that enables it is documented, and the reason it is off is a comment pointing at
`docs/release/needs-humans.md` rather than a TODO.

**Verify:** a test asserts that with collection disabled, no network request is made by the package.

### Step 5: Capture the baseline and the worst-ten list

**Files:** Create `benchmarks/frontend/rc.1.json`, `docs/perf/worst-ten.md`

**Do:** full run of all three TASK-031 harnesses across four apps × two locales. List **the worst ten
routes per app** — this is the work queue TASK-022 is scoped from. State in the file that the list is
lab-derived and what that means.

**Verify:** `benchmarks/frontend/rc.1.json` is committed with its profile block; the worst-ten file has
ten entries per app, each traceable to a metric in the artifact.

## Definition of done

- [ ] Every app build reports the same sha `GET /api/v1/system/build` returns, asserted in an e2e.
- [ ] With the directive resolver denying, the collector emits nothing — proven in **both** consent
      modes.
- [ ] No collector payload contains PII or a full URL with a query string.
- [ ] Every event carries route, tenant, locale, device class, and theme revision at collection time.
- [ ] With collection disabled, the package makes no network request.
- [ ] `benchmarks/frontend/rc.1.json` is committed with its profile block.
- [ ] `docs/perf/worst-ten.md` lists ten routes per app and states that the list is lab-derived.
- [ ] No behaviour change: `pnpm check:all` and the e2e suite are green.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:all
pnpm check:boundaries
pnpm check:budget --report-only
pnpm check:lighthouse --report-only
pnpm check:a11y --report-only
pnpm test:e2e
```

## Out of scope

Any optimisation (TASK-022), any remediation (TASK-027), turning any gate blocking, and the error
tracker itself (TASK-020 — this task only establishes the release tag it will use).

## Parked

Live RUM collection, four weeks of field p75s, queryable segmentation, and a field-derived worst-ten
list — see [`../../release/needs-humans.md`](../../release/needs-humans.md).

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
