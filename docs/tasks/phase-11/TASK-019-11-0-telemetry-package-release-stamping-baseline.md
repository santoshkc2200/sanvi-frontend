# TASK-019: 11.0 Telemetry package, release stamping & baseline

**Phase:** 11 · **Status:** done · **Size:** M
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

- [x] Every app build reports the same sha `GET /api/v1/system/build` returns, asserted in an e2e.
- [x] With the directive resolver denying, the collector emits nothing — proven in **both** consent
      modes.
- [x] No collector payload contains PII or a full URL with a query string.
- [x] Every event carries route, tenant, locale, device class, and theme revision at collection time.
- [x] With collection disabled, the package makes no network request.
- [x] `benchmarks/frontend/rc.1.json` is committed with its profile block.
- [x] `docs/perf/worst-ten.md` lists ten routes per app and states that the list is lab-derived.
- [x] No behaviour change: `pnpm check:all` and the e2e suite are green.

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

## Execution notes (2026-09-18)

**Gating purpose — `analytics`, not a new `telemetry` purpose.** The purpose registry is
backend-owned (the union is a generated OpenAPI type; `packages/consent` re-exports it rather than
redefining it), and this task's file-ownership map has no backend or `packages/consent` changes. RUM
is measurement, and `analytics` is the registry's measurement purpose — deliberately outside
`OPT_OUT_PURPOSES`/`GPC_PURPOSES`, so a US statutory opt-out does not stop measurement while a
direct denial of `analytics` does. Tests pin both modes: EU opt-in denies until consent; US
notice-and-opt-out allows until opted out; an explicit resolver denial in either mode suppresses
everything (sources never start — not a reduced payload, not a sampled one).

**Release stamping.** `@sanvi/telemetry/release` (node-only export) computes the stamp in each app's
`vite.config.ts`: commit from git, semver from the app's `package.json`, RFC 3339 built-at,
environment — with `SANVI_GIT_COMMIT` / `SANVI_BUILT_AT` / `SANVI_ENVIRONMENT` overrides declared in
turbo's `globalEnv` so a cached build cannot silently replay a stale identity. The shape is the
generated `BuildDetails` contract type, never redefined; each app's `/health` surface reports it
alongside the existing `version`. Non-git checkouts stamp `commit: "unknown"` rather than inventing
a sha.

**Build-probe e2e.** The storefront compares `/health` against a live `GET /api/v1/system/build`
stand-in (its mock API serves the same pinned stamp the build embedded) — field-for-field equality,
no live backend required. The other three apps have no backend alongside their preview; their specs
assert `/health` equals the pinned fixture, and the fixture deliberately does *not* pin `version`
(that comes from `package.json`), so a version bump without a fixture update fails with exactly that
diff. The api-client wrapper (`getSystemBuild`) is unit-tested against the generated contract path.

**Regenerated client absorbed unrelated backend drift (additive).** `pnpm generate:api` pulled in
backend work merged since the last regeneration: the ad review-status endpoint
(`/api/v1/tenant/ads/campaigns/{id}/review-status` + `AdReview*` schemas), a `ConflictReasoned`
`ApiError` variant, and `BudgetType` gaining `campaign_budget_optimization` (consumed as
`string[]` by the form engine, so no compile impact). Nothing breaks; the review-status wrapper
belongs to a future advertising task, not this one.

**`fetch` boundary.** The collector's transport may not call `fetch` — lint-gated outside
`@sanvi/api-client`, and TASK-014's beacon already set the precedent. The keepalive POST factory
lives in api-client (`createKeepalivePoster`); telemetry's default transport wraps it, and telemetry
keeps a type-only relationship with everything else in api-client.

**New dependency: `web-vitals` ^5 (catalog).** Per the dependency policy: Google's Core Web Vitals
reference implementation, used for LCP/CLS/INP/TTFB/FCP — INP in particular is too easy to get
subtly wrong by hand and a wrong collector poisons future RUM. ~3 KB gzip, MIT, actively maintained
by Google; loaded only inside the collector's dynamic import, so it never enters any app's initial
bundle (budgets unchanged: storefront initial 167.8/180 KB, marketing 138.8/150 KB, all 85 routes
inside their per-route budgets).

**Collection is off in all four apps, and off means off.** Each app wires a `TELEMETRY_ENABLED =
false` module whose dynamic `import('@sanvi/telemetry')` is dead code until the flag flips — the
collector never enters any bundle. The storefront passes the real `ConsentStore`; marketing, admin,
and platform-admin have no consent wiring yet, so they pass `store: null`, and `null` means
*denied* — suppression is the default, not an accident. The reason it is off is a comment pointing
at `docs/release/needs-humans.md` in each wiring module, not a TODO.

**Gate results.** `pnpm lint`, `typecheck`, `test` (all 24 package/app test tasks), forced-clean
`turbo run typecheck test build check:i18n check:tokens check:budget` (69/69), `check:boundaries`,
`check:connect-bundle`, the bundle secret scan, and `pnpm check:budget --report-only` all green.
At turbo's default concurrency this machine intermittently times out one 5 s component test per run
under full parallel load (task setup stretched to ~175 s; a *different* app's test failed each
time, and each passes standalone) — a forced clean run at `--concurrency=4` is green; no failure
traces to this task's changes.

`check:lighthouse --report-only` and `check:a11y --report-only` ran clean (artifacts written to
their gitignored scratch paths; the same numbers are embedded in the committed `rc.1.json`): axe
0 critical / 0 serious across 85 routes × en/ja, with the moderate findings left as TASK-027's
inventory; Lighthouse medians under the pinned profile range from perf 1.00 (storefront `/`) to
0.90 (admin `/`), LCP 1451–2891 ms.

**E2E, run sequentially per app** (the full parallel `pnpm test:e2e` is not a usable signal on this
machine — one suite was SIGINT-killed mid-run): `marketing` 15/15 and `platform-admin` 8/8 green;
`admin` 142 passed with exactly the failures the backlog has recorded since TASK-015 —
`advertising-campaigns` ×2 and `payments-onboarding` ×4, reproduced on base by three earlier tasks;
`storefront` 97 passed plus 18 failures in `locale.spec.ts`/`us-privacy.spec.ts` that reproduce
**identically on a clean `main` worktree** (18 failed / 12 passed on both `main` and this branch —
verified, not assumed; first recorded at TASK-014 as "storefront locale/privacy ×22"). This task
adds four `release-stamp` specs, all green, and no new e2e failures.

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
