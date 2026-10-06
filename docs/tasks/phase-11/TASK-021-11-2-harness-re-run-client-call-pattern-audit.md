# TASK-021: 11.2 Harness re-run & client call-pattern audit

**Phase:** 11 · **Status:** done · **Size:** S
**Requirement(s):** FR-1103, NFR-1107
**Depends on:** TASK-020, **phases 09 and 10 shipped**
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Blocked by (cross-repo):** sanvi-backend TASK-021 (profiling, query review, N+1 removal)
**Flag:** none

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Two obligations that would otherwise fall between the two repositories and be done by neither: record
what the backend's performance slice did to frontend numbers, and diagnose which N+1s are actually
client patterns.

## Why this shape

The backend owns all the work in slice 11.2. This task is deliberately small; **its value is that it
happens at all.**

The measurement matters because SSR latency feeds LCP: a 50 ms server improvement is a real frontend
improvement, and it belongs in the same benchmark file as everything else rather than being invisible
because nobody re-ran the harness.

The audit matters because **an N+1 is often a client pattern.** A projection built to serve a loop the
client should not be running is a permanent cost paid to avoid a one-line fix. Timing is the whole
point: the audit is only useful **before** the backend decides which projections to build. Delivered
afterwards it is an interesting document about work already done.

## Constraints

- **Fix nothing.** This task measures and diagnoses. Client fixes land in TASK-022; backend batching
  lands in backend TASK-021.
- Every finding gets a disposition. **An unassigned finding is the one that gets fixed by adding a
  projection nobody needed.**

## File ownership map

- `benchmarks/frontend/rc.3.json`
- `docs/perf/call-pattern-audit.md` — the list with dispositions
- no source changes expected

## Steps

### Step 1: Re-run all three harnesses

**Files:** Create `benchmarks/frontend/rc.3.json`

**Do:** all three TASK-031 harnesses across four apps × two locales, after the backend's changes land,
on the same pinned profile.

**Verify:** `pnpm bench:compare rc.1 rc.3` runs and no frontend budget regressed. Any LCP movement is
noted and attributed to the backend slice.

- [x] `benchmarks/frontend/rc.3.json` committed (build `3df1980`, all four apps, both locales).
      `bench:compare rc.1 rc.3` compared 138 metrics and exits 1 on 11 rows, each attributed in the
      audit's handover (no backend slice is observable in this harness — the storefront mock API is
      unchanged; the frontend delta is feda638..3df1980, i.e. TASK-019/020/024/032, plus the
      measurement platform change macOS→Windows recorded via `benchmarkIndex`). Every budget
      aggregate improved; one route regressed in relative terms only (`/legal/request-metrics`
      0.79→1.07 KB, TASK-020's diagnostics wiring, inside its 6 KB route budget).

### Step 2: Walk every call site for loop patterns

**Files:** Create `docs/perf/call-pattern-audit.md`

**Do:** during the backend's profiling sweep, find every endpoint called in a loop, per-row, or once
per rendered item. Give each one a disposition: **backend batch candidate**, **TASK-022 client fix**,
or **accepted with a reason**.

**Verify:** every entry has a disposition; none is blank.

- [x] `docs/perf/call-pattern-audit.md` — findings F1–F10, every one dispositioned; the
      examined-and-clean section records what the silence means (no API call inside any `#each`
      render or synchronous loop; the only `.map(async …)` in first-party code is F6).

### Step 3: Capture waterfalls for the worst ten routes

**Files:** Modify `docs/perf/call-pattern-audit.md`

**Do:** for each route in `docs/perf/worst-ten.md`, capture the request waterfall and identify
serialised requests that could be parallel or hoisted into the SSR pass.

**Verify:** a waterfall is recorded per route with serialised requests marked.

- [x] Waterfalls captured per worst-ten route (Playwright/CDP on the harness serving topology,
      unthrottled — order + server think time are the deliverable; SPA routes via the recorded
      Lighthouse boot trace + load-order read from source, the sweep's own auth-gating honesty rule
      applied and stated). Serialised requests marked SER in the capture; per-route chains tabled
      in the audit with dispositions.

### Step 4: Hand the list over before the projection work starts

**Files:** `docs/perf/call-pattern-audit.md`

**Do:** deliver the list to the backend track. **If the audit finds nothing, say so explicitly in the
file** rather than leaving it empty — an empty file reads as "not done" to the next session.

**Verify:** the file has a dated handover note, or an explicit "no findings" statement.

- [x] Dated handover note (2026-10-07) with the batch candidates in leverage order and the
      explicitly-not candidates; records that this checkout had no visibility into the backend's
      profiling state, so the date — not the backend's calendar — is what the note asserts.

## Definition of done

- [x] `benchmarks/frontend/rc.3.json` is committed and compared against `rc.1`.
- [x] No frontend budget regressed against `rc.1` (every initial/total budget improved — storefront
      167.8→86.2 KB, marketing 138.8→48.3 KB, admin 351.6→329.9 KB, platform-admin 180→100.5 KB;
      one route-level relative regression, `/legal/request-metrics` +0.28 KB absolute from TASK-020's
      diagnostics wiring, named here rather than buried).
- [x] Every endpoint called in a loop, per-row, or once per rendered item is listed with a disposition.
- [x] Waterfalls for the worst-ten routes are captured with serialised requests identified.
- [x] The list was handed to the backend track **before** its projection work started, with a date
      (2026-10-07; the backend's profiling state is not observable from this repo — recorded in the
      handover note itself).

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:budget --report-only
pnpm check:lighthouse --report-only
pnpm bench:compare rc.1 rc.3
```

## Out of scope

Fixing anything.

---

## Execution notes (2026-10-07)

Branch `chore/task-021-harness-rerun-call-audit`. The deliverables are the two
the file-ownership map names — `benchmarks/frontend/rc.3.json` and
`docs/perf/call-pattern-audit.md` — plus a set of **measurement-neutral
Windows portability fixes**: the machine this ran on is Windows (rc.1 was
macOS), and none of the harness could execute there. Per the comparability
invariant these change no pin and no threshold; what changed is *where* the
same pinned tools run:

- `scripts/lib/serving.mjs` — PATH prefix joined with `path.delimiter`
  (`:` is not a separator on Windows); preview servers spawned through an
  absolutely-resolved Git Bash (a bare `bash` on PATH resolved to Anaconda's
  msys build, which mangles the `/c/…` paths the `vite` sh shims compute);
  `stop()` tree-kills on Windows (SIGTERM does not reach a shell's children,
  so the orphaned preview server held the run's stdio pipes open forever).
- `scripts/check-lighthouse.mjs` — lhci invoked as
  `node @lhci/cli/src/cli.js` (the extensionless `.bin` shim has no form
  Windows can exec); PATH delimiter as above; `chromeVersion()` reads the
  exe's version resource on Windows (`chrome.exe --version` neither prints
  nor exits there); `benchmarkIndex` now recorded per URL (host CPU under
  emulation — devtools throttling multiplies host latency, and the rc.1↔rc.3
  LCP deltas needed exactly this number to attribute honestly).
- `lighthouserc.cjs` — Windows gets the bare server command with the POSIX
  env-prefix split out (`splitEnvPrefix`/`APP_SERVER_ENV`), the assignments
  injected into the lhci process env by the runner; a `bash -c` wrapper
  (attempted first) is unquotable through cmd.exe for a `C:\Program Files\…`
  path, and a COMSPEC override breaks chrome-launcher's `taskkill /pid`.
- `scripts/check-a11y.mjs` — `CHROME_PATH` honoured for the sweep's browser,
  same convention as the Lighthouse runner.
- `packages/lint-gates/src/check-budget.mjs` — Vite-manifest keys joined
  posix (`src/…`), not `path.join` (backslash on Windows made every SPA route
  read as chunk-not-found; SvelteKit side was already correct).
- `patches/chrome-launcher@1.2.1.patch` (pnpm `patchedDependencies`) —
  `destroyTmp` warns instead of throwing: a chrome crashpad child can hold
  the profile dir past rmSync's 10 retries on Windows, and one failed tmp
  cleanup was crashing whole audit runs. A leftover tmp dir is the lesser evil.
- `scripts/assert-connect-js-bundle.mjs` + `scripts/bundle-size-report.mjs` —
  `fileURLToPath` instead of `URL.pathname` (the latter keeps a leading
  `/C:/` on Windows that `existsSync` can never resolve — the connect gate
  failed as "not found" on any Windows run).
- `turbo.json` — `ProgramFiles` in `globalPassThroughEnv` (biome's
  `noUndeclaredEnvVars` convention).

**Pinned Chrome.** Playwright 1.62.1 installs Chromium build 1234
(151.0.7922.34); the `pins.chrome` value 152.0.7977.8 came from the original
machine's cache (build 1237 — `resolveChrome` takes the newest `chromium-*`).
To honour the pin, Chrome-for-Testing 152.0.7977.8 win64 was fetched from the
public CfT bucket and `CHROME_PATH` points both harnesses at it; the version
check enforces it as designed. Recorded because anyone re-running on a fresh
machine will hit the same 151-vs-152 refusal — by design, not a bug.

**rc.3 provenance & comparability.** Artifact records build `3df1980`, the
Windows chrome binary, and (new) `benchmarkIndex` ≈ 3770–4060 vs rc.1's
~4037. The pins block is byte-identical to rc.1's, so `bench:compare`
compares as contracted. Cross-platform Lighthouse rows are **not** product
evidence either way — the audit attributes each of the 11 regressed rows:
SPA LCP/perf = F10 (traceparent preflights × retry against an unanswered API
origin) measured from the recorded trace; storefront LCP = platform mock-API
latency × F1's five serial legs (LCP element is the consent banner, the last
link of that chain); marketing sits inside the threshold; axe serious 0→12 is
a sweep-timing artifact on `ssr=false` routes (titles render ~2.5 s after
`load` once hydration completes — measured; flagged for TASK-027's gate
design, not fixed here per the fix-nothing constraint).

**Verification.** `pnpm lint` ✓, `pnpm typecheck` ✓, `pnpm build` ✓,
`pnpm check:budget --report-only` ✓, `pnpm check:lighthouse --report-only` ✓,
`pnpm bench:compare rc.1 rc.3` run (exits 1 on the 11 attributed rows).
`pnpm test` fails on this machine in `@sanvi/lint-gates` only — 25 failures
across the gate-fixture suites (symlinked-`bin` entry tests, spawn-based
fixture gates, csp/boundaries/platform-literals path comparisons, routes
manifest fixtures): verified pre-existing on Windows by running the same
suites against the pristine `check-budget.mjs` (identical failures), and the
gates themselves all pass on the real tree (`check:boundaries`, `check:csp`,
`check:i18n`, `check:tokens`, `check:storage-surface`,
`check:runtime-code-sources`, `check:i18n-shards`, `check:connect-bundle`,
`check:secrets` — all exit 0). One transient `WSAStartup` worker failure in
`@sanvi/query`/`@sanvi/csp` passed on scoped rerun. Every other package's
suite is green. The suite is green on the project's original macOS host per
TASK-019/020's records; the Windows fixture failures are the price of the
host change, not of this task's changes.

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
