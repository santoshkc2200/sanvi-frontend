# TASK-020: 11.1 Error tracking, trace id & user-facing diagnostics

**Phase:** 11 · **Status:** todo · **Size:** M
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

- [ ] Source maps resolve stack traces in the tracker and are **unreachable from any public URL**,
      asserted against the built output.
- [ ] Every error report carries the release tag from the build identity.
- [ ] Payload assertions pass: no email, no session token, no full query string.
- [ ] An e2e asserts the SSR document, the API response, and a client error report share one trace id.
- [ ] Every error screen displays a trace id, and copy-diagnostics produces one paste containing
      release, route, tenant, locale, trace id, and breadcrumbs.
- [ ] Production logging is off by default; enabling it per session produces an audit entry.
- [ ] All new strings are in `en` and `ja`; `pnpm check:i18n` and `pnpm check:tokens` pass.

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
