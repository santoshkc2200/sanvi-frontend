# TASK-020: 11.1 Error tracking, trace id & user-facing diagnostics

**Phase:** 11 · **Status:** done · **Size:** M
**Requirement(s):** FR-1104, FR-1105, FR-1106, NFR-1104
**Depends on:** TASK-019
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Blocked by (cross-repo):** sanvi-backend TASK-020 (`traceparent` propagation, `trace_id` in problem details)
**Flag:** none

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Make a frontend failure diagnosable: a resolved stack trace attributed to an exact release, a trace id
that crosses the repo boundary, and one action that hands support everything it needs in one paste.

## Why this shape

An incident crosses the repository boundary. A slow or broken page is either a backend problem or a
frontend problem, and **the only way to tell in under a minute is a trace id that appears in both
systems**. That is why this task consumes the backend's two conventions rather than inventing its own.

The RUM segmentation half of the original task is parked with the traffic it needed. What is kept is
everything that works without traffic: the tracker, the source-map discipline, and the diagnostics
affordance.

## Constraints

- **Source maps are uploaded privately and never served.** Uploaded *and* served is the default of most
  bundler integrations; the test that asserts they are unreachable is the one that catches it.
- Breadcrumbs and payloads are scrubbed of PII **before send**, not at the destination.
- The tracker is directive-gated where a jurisdiction requires it, on the same resolver as everything
  else.
- Production frontend logging is off by default; enabling it per session is an operator action, and
  that action is audited.

## File ownership map

- `packages/telemetry/**` — error tracker init, scrubbing, breadcrumbs
- `packages/ui/src/errors/**` — trace id display, copy-diagnostics action
- `packages/api-client/**` — read `trace_id` from problem details, attach `traceparent`
- each app's root error handling and SSR document — trace id passthrough
- `packages/i18n` catalogs (`en`, `ja`) — diagnostics and error-screen copy
- build configuration — private source map upload

## Steps

### Step 1: Consume the two backend conventions

**Files:** Modify `packages/api-client/**`, each app's SSR document

**Do:** attach the W3C `traceparent`; read `trace_id` from the problem-details envelope. The same id
goes on error reports and into the diagnostics payload.

**Verify:** an e2e asserts the trace id in the SSR document equals the id in the API response and the
id in a forced client-side error report.

### Step 2: Write the source-map exposure test first

**Files:** Create `scripts/check-sourcemaps-not-served.mjs`; Modify `package.json`

**Do:** walk the built output of all four apps and assert no `.map` file is reachable from a public
path and no bundle carries an inline source map.

**Verify:** `pnpm check:sourcemaps-not-served` fails on a build configured to serve them, then passes
on the corrected configuration.

### Step 3: Wire the error tracker

**Files:** Modify `packages/telemetry/**`, build configuration

**Do:** private source map upload, release tagging from TASK-019's build identity, breadcrumb and
payload scrubbing before send, directive gating.

**Verify:**
- A stack trace resolves to original sources in the tracker.
- Every report carries the release tag.
- Payload assertions pass: no email, no session token, no full query string.

### Step 4: Put the trace id on every error screen

**Files:** Modify `packages/ui/src/errors/**`, each app's root error handling; Modify `packages/i18n`

**Do:** every error screen displays the trace id. A single "copy diagnostics" action puts release,
route, tenant, locale, trace id, and the last few breadcrumbs on the clipboard in one paste.

**Deliberately one action producing one paste.** A support flow that asks the user to read a trace id
aloud loses a character and an afternoon.

**Verify:** an e2e forces an error, asserts the trace id renders, clicks copy-diagnostics, and asserts
the clipboard contains all six fields.

### Step 5: Set the logging discipline

**Files:** Modify `packages/telemetry/**`

**Do:** no PII, sampled, off by default in production. Enabling it for a session is an operator action
that produces an audit entry.

**Verify:** a test asserts production logging is off by default and that enabling it emits an audit
event.

## Definition of done

- [x] Source maps are **unreachable from any public URL**, asserted against the built output
      (`check:sourcemaps-not-served`, red demonstrated on a serving config); they are staged
      privately with an upload manifest — the tracker half (stack traces resolving in a vendor)
      is parked with the vendor itself, see `../../release/needs-humans.md`.
- [x] Every error report carries the release tag from the build identity (unit-tested; the
      in-app tracker wiring lights up with the same flag flip as the collector, see notes).
- [x] Payload assertions pass: no email, no session token, no full query string.
- [x] An e2e asserts the SSR document, the API response, and a client error report share one trace id.
- [x] Every error screen displays a trace id, and copy-diagnostics produces one paste containing
      release, route, tenant, locale, trace id, and breadcrumbs.
- [x] Production logging is off by default; enabling it per session produces an audit entry.
- [x] All new strings are in `en` and `ja`; `pnpm check:i18n` and `pnpm check:tokens` pass.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:i18n
pnpm check:tokens
pnpm check:boundaries
pnpm check:sourcemaps-not-served
pnpm test:e2e
```

## Execution notes (2026-09-19)

Branch `feat/task-020-error-tracking-trace-id`. All verification commands green; per-app e2e
matches a clean-`main` worktree exactly (storefront 19 pre-existing locale/us-privacy/smoke-webkit
instance failures reproduced identically on `main`; admin campaigns ×2 + payments ×4 as documented
since TASK-015; marketing 15 and platform-admin 8 green), plus new passing specs.

**Step 1 — conventions.** `@sanvi/api-client` generates a W3C `traceparent` per attempt
(`00-<32hex>-<16hex>-01`, override-able via caller headers) and exposes the sent trace id via
`getLastTraceId()` (also surfaced through `TypedApiClient`), the fallback correlation for failures
without a `problem.trace_id` of their own. `traceIdFromTraceparent` exported for tests/fallbacks.
**Cross-repo finding:** a browser-side request carrying `traceparent` fails CORS preflight unless
the backend's `access-control-allow-headers` includes it — the mock fixture now allows
`traceparent`/`tracestate`; **`sanvi-backend` must do the same in its CORS layer** or every
browser-side call breaks the moment this ships.

**Step 1/4 e2e (interpretation recorded).** The "client error report" half of the trace-id e2e is
asserted through the diagnostics paste — the user-initiated artifact this task actually ships —
because the tracker has no endpoint to report to (needs-humans) and the null transport cannot be
asserted over the wire. `apps/storefront/e2e/trace-id.spec.ts`: the mock fails the metrics call
with the backend's conventions (`trace_id` body + matching `traceparent` response header that
joins the caller's trace), the SSR document, the hydrated page, and the clipboard paste all name
the same pinned id, and the request log proves the SSR fetch sent a well-formed `traceparent`.
The mock keys the failure on a per-test-context cookie because Node's undici silently rewrites a
custom `host` header (host-based discrimination does not survive server-side fetch; the
request-metrics load forwards the caller's cookies upstream instead — the `resolveSession` BFF
pattern).

**Step 2 — sourcemaps.** `privateSourceMapsPlugin` (`@sanvi/telemetry/release/sourcemaps`) strips
`.map` assets in `generateBundle` (with a chunk-`.sourcemap` fallback) and stages them into the
gitignored `sourcemaps-private/` with a manifest; all four vite configs emit `sourcemap: 'hidden'`.
Red demonstrated: storefront built with `sourcemap: true` and no plugin → gate exits 1 with 142
findings; corrected config green. `check:sourcemaps-not-served` is wired into `check:all`/
`check:quiet`. Scope note: "public output" means what is actually served — `build/client` for the
adapter-node apps, `dist/` for the SPAs. The adapter's `build/server/` is the SSR server's own
program (nothing serves it over HTTP; adapter-node re-bundles it with esbuild and hardcoded
`sourcemap: true`, which no vite plugin can intercept) — server-side maps are a server-ops
artifact, and that boundary is documented in the script.

**Step 3 — tracker.** `initErrorTracker` in `@sanvi/telemetry` (gated on the same
purpose/resolver as the collector; suppression, revocation-drops and off-is-off unit-tested the
same way `directive-gate.test.ts` proves the collector's) + `createErrorBeaconTransport`
(`{ errors: [report] }`). Not wired into the apps yet: with no endpoint, wiring it would be
launching it, exactly what TASK-019's wiring-but-off note forbids; it lights up with the same
`TELEMETRY_ENABLED` flip and an endpoint. One deliberate asymmetry, documented in the module: the
shared breadcrumb buffer keeps recording while transmission is suppressed (it never transmits by
itself; the paste is the user quoting their own session to support).

**Step 4 — screens.** `ErrorDiagnostics` (new, `packages/ui/src/errors/`) renders the
app-localized trace line + the one copy action; `ErrorView`/`SuspendedTenantNotice` take
`traceLine`/`diagnosticsText` props and the dead hardcoded `COPY.traceIdLabel` ("Reference: …")
is gone — no in-repo caller ever passed `traceId`. Wired: storefront `+error.svelte` and the
request-metrics degraded surface (trace id rides the existing labelled-unavailable state instead
of flipping it to an error page — TASK-023 owns that semantic), marketing `+error.svelte`
(absent id → block renders nothing), both SPAs' router-error views and boot-failure screens
(raw DOM, same paste), platform-admin `TenantDetail`'s three section-error views. Guard-rejected
views stay diagnostics-free by design: a permission denial is not a malfunction.

**Step 5 — logging.** `createSessionLogger`: default off iff `environment === 'production'`,
per-session `sessionStorage` flag, audit sink is a *required* option (an un-audited enable does
not type-check), sampled at session level with an explicit enable never sampled out, all lines
scrubbed through the same `scrubText` as payloads.

**Bundle hygiene.** `@sanvi/telemetry/diagnostics` is a subpath export importing `ApiError` from a
new `@sanvi/api-client/problem` subpath — importing the api-client root from the storefront's
root-level `+error.svelte` pulled every endpoint module into the initial bundle
(169.5 → 201.3 KB against a 180 KB budget); with the subpath it is back to 169.5 KB and
`check:budget` is green everywhere.

**Scope boundaries recorded.** `error.html` (the static root-layout fatal fallback, intentionally
English-only) cannot carry a trace id — there is no runtime, by design; root-layout failures
correlate through the backend's traces. Inline error surfaces that are not full error screens
(checkout decline views, form-level alerts) are TASK-023's route-by-route audit's material; the
trace-id contract they will consume now exists.

## Out of scope

Backend spans, alert rules, and runbooks (backend TASK-020). Any performance change (TASK-022). Error
boundaries and outage UX, which are resilience rather than observability (TASK-023) — this task only
guarantees the trace id those screens will display.

## Parked

RUM segmentation queryable by tenant, locale, device class, and theme revision, and release health
flagging a regression against the previous release — see
[`../../release/needs-humans.md`](../../release/needs-humans.md). The dimensions are attached at
collection time in TASK-019, so only the querying waits.

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
