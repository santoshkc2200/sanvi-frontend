# TASK-020: 11.1 Error tracking, RUM segmentation & user-facing diagnostics

**Phase:** 11
**Status:** todo
**Requirement(s):** FR-1104, FR-1105, FR-1106, NFR-1104
**Depends on:** TASK-019
**Created:** 2026-08-21

**Blocked by (cross-repo):** sanvi-backend TASK-020 (`traceparent` propagation, `trace_id` in problem details)
**Slice:** 11.1 — Observability completion, SLOs & alerting
**Prerelease:** `v1.0.0-rc.2` · **Flag:** none

## Context

A field incident crosses the repo boundary. A slow page is either a slow query or a heavy bundle, and
the only way to tell in under a minute is **a trace id that appears in both systems**. That is why both
tracks land this slice together rather than the frontend catching up later.

The segmentation built here is also what makes TASK-022's scope choice honest: an average hides the
tenant with the heavy Japanese font and the expensive published theme, and that tenant is the one the
targets are set by.

## What to do

- [ ] **Contract** — consume the backend's two conventions: the W3C `traceparent` on server-rendered
      documents and API responses, and `trace_id` in the problem-details envelope. The same id goes on
      error reports and into the copy-diagnostics payload.
- [ ] **Error tracking** — source maps uploaded privately and **never served**, release-tagged with
      TASK-019's build identity, breadcrumbs and payloads scrubbed of PII before send, and the tracker
      itself directive-gated where a jurisdiction requires it.
- [ ] **RUM segmentation** — Core Web Vitals by route, tenant, locale, device class, **and theme
      revision**. The segmentation is what makes TASK-022's scope choice defensible.
- [ ] **Release health** — error rate and vitals per release, with an automatic flag on regression
      against the previous release, wired into the same alert tiers as the backend.
- [ ] **User-facing diagnostics** — every error screen shows a trace id, and a "copy diagnostics" action
      puts release, route, tenant, locale, trace id, and the last few breadcrumbs on the clipboard in one
      paste. Support asks one question instead of five.
- [ ] **Frontend logging discipline** — no PII, sampled, off by default in production, and enabled per
      session only by an operator action that is itself audited.

## Acceptance criteria

- [ ] Source maps resolve stack traces in the tracker and are **not reachable from any public URL**,
      asserted by a test against the built output.
- [ ] Every error report carries the release tag from the build identity.
- [ ] Error-tracker payload assertions pass: no email, no session token, no full query string.
- [ ] RUM is queryable by route, tenant, locale, device class, and theme revision.
- [ ] Release health flags a regression automatically against the previous release, and the flag reaches
      the same alert tiers as the backend's.
- [ ] An e2e asserts the trace id in the SSR document equals the id in the API span and the id in a
      forced client-side error report.
- [ ] Every error screen displays a trace id, and "copy diagnostics" produces a single paste containing
      release, route, tenant, locale, trace id, and breadcrumbs.
- [ ] Production frontend logging is off by default; enabling it per session produces an audit entry.
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

Backend spans, dashboards, SLO targets, burn-rate alerts, and runbooks (backend TASK-020). Any
performance change (TASK-022). Error boundaries and outage UX, which are resilience rather than
observability (TASK-023) — this task only guarantees the trace id those screens will display.

## Files likely touched

- `packages/telemetry/**` (error tracker init, scrubbing, breadcrumbs, release health)
- `packages/ui/src/errors/**` (trace id display, copy-diagnostics action)
- `packages/api-client/**` (read `trace_id` from problem details, attach `traceparent`)
- each app's root error handling and SSR document (trace id passthrough)
- `packages/i18n` catalogs (`en`, `ja`) — diagnostics and error-screen copy
- build config (private source map upload)

## Notes / gotchas

- Rollback: the tracker and RUM are additive and directive-gated; disabling either is a config change.
  Nothing here can serve a wrong response.
- Source maps uploaded and *also* served is the default of most bundler integrations. The test that
  asserts they are unreachable is the one that catches it.
- "Copy diagnostics" is deliberately one action producing one paste. A support flow that asks the user to
  read a trace id aloud loses a character and an afternoon.

---
*On completion: satisfy every acceptance criterion, run the verification commands,
then record status with the sdlc-planner script (never by hand-editing this line
and the backlog separately):*
`sdlc.py status TASK-020 done --note "<PR or commit>"`
