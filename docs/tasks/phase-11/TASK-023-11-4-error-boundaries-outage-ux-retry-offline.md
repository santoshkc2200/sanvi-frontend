# TASK-023: 11.4 Error boundaries, outage UX, retry & offline

**Phase:** 11 · **Status:** todo · **Size:** L
**Requirement(s):** FR-1111, FR-1112, FR-1113, NFR-1105
**Depends on:** TASK-021, **phases 09 and 10 shipped**
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Blocked by (cross-repo):** sanvi-backend TASK-023 (`503 platform/overloaded` + `Retry-After`, degraded-mode header)
**Flag:** `platform.degraded_mode` (backend-owned)

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

The backend decides what the system *does* when a dependency fails. This decides what the user *sees* —
and the bar is that during an injected failure users see a **designed experience**, not an incidental
toast on top of a blank panel.

## Why this shape

Two rules shape everything here.

**Nothing spins forever.** Every async surface has a timeout and a terminal state. The route-by-route
audit that produces that list is a **deliverable, not scaffolding**: TASK-027 reuses it as its route
inventory, and a sampled audit produces a sampled accessibility pass.

**Honesty over reassurance.** A degraded response says it is degraded, stale content says what is
stale, and a non-idempotent action that might have succeeded asks rather than silently retrying.

## Constraints

- `429` and `503` mean different things — you asked too often versus we are too busy — so they get
  different backoff and different copy.
- **Nothing is queued that could execute twice.** "Safe to defer" is a narrower set than it looks: if a
  queued action cannot be made idempotent, it is not queueable, and saying so honestly beats queueing
  it and hoping.
- Outage screens are reviewed as design, not assembled from generic toasts.

## File ownership map

- each app's route-level error boundaries and outage screens
- `packages/api-client/**` — backoff with jitter, `Retry-After`, idempotency-aware retry policy
- `packages/ui/**` — async state primitives with timeouts, degraded banner surface
- offline detection and the safe-action queue
- `packages/i18n` catalogs (`en`, `ja`) — outage, retry, stale-content, offline copy
- e2e specs (slow-network and offline projects), `docs/ux/async-state-audit.md`

## Steps

### Step 1: Audit every async surface, route by route

**Files:** Create `docs/ux/async-state-audit.md`

**Do:** enumerate every route and every async surface within it. For each: does it have loading, empty,
error, and success states, and a timeout with a terminal state? **Enumerate, do not sample** — TASK-027
inherits this list.

**Verify:** the audit covers every route in every app's route definitions, asserted by a check that
compares the audit against the route manifest.

### Step 2: Consume the backend's two additions

**Files:** Modify `packages/api-client/**`

**Do:** `503` with `Retry-After` and the `platform/overloaded` problem type; the degraded-mode response
header that tells this repo when to say so.

**Verify:** a test asserts `429` and `503` produce different messages and different backoff.

### Step 3: Add error boundaries per route

**Files:** Modify each app's route definitions; Modify `packages/ui/**`

**Do:** a recovery action and TASK-020's trace id. Never a blank page, never a full-app crash from one
panel.

**Verify:** a test forces a panel-level failure and asserts the app survives, the boundary renders, and
both the recovery action and the trace id are present.

### Step 4: Design the outage experience per app

**Files:** Modify each app's outage screens; Modify `packages/i18n`

**Do:** storefront serves cached content where possible **and says what is stale**; admin explains the
outage and offers retry; marketing is static and unaffected; platform-admin surfaces the incident
directly.

**Verify:** an e2e simulates a total backend outage and asserts a designed state in all four apps.

### Step 5: Give every async surface a terminal state

**Files:** Modify `packages/ui/**` and every route flagged by the audit

**Do:** work the audit list until no entry lacks a state or a timeout.

**Verify:** every route renders a designed state with the API returning 500, 503, and a timeout —
**asserted per route, not sampled**. No infinite spinner remains.

### Step 6: Implement retry honestly

**Files:** Modify `packages/api-client/**`

**Do:** exponential backoff with jitter, a manual retry affordance, `Retry-After` respected rather than
ignored. Idempotent mutations retry silently; non-idempotent ones ask.

**Verify:** a test proves a non-idempotent mutation is never retried automatically.

### Step 7: Add offline detection and a queue that cannot double-submit

**Files:** Create offline detection and the safe-action queue

**Do:** queue only actions that are safe to defer; honest messaging for those that are not.

**Verify:** a test replays a queued action after reconnect and asserts no double submission.

### Step 8: Add throttled and offline e2e projects

**Files:** Modify e2e configuration and specs

**Do:** throttled runs of the critical journeys per app, plus an offline variant for the storefront.

**Verify:** `pnpm test:e2e --project=slow-3g` and `--project=offline` are green.

## Definition of done

- [ ] The route-by-route audit covers every route, verified against the route manifest.
- [ ] Every route renders a designed state with the API returning 500, 503, and a timeout — per route.
- [ ] No infinite spinner remains.
- [ ] An error boundary contains a panel failure and shows a recovery action plus the trace id.
- [ ] A simulated total backend outage produces a designed, honest experience in all four apps.
- [ ] `Retry-After` from a `503` is respected; `429` and `503` produce different messages and backoff.
- [ ] Idempotent mutations retry silently; non-idempotent ones ask, proven by a test.
- [ ] The offline queue never double-submits, proven by a replay test.
- [ ] A degraded-mode response is surfaced as degraded, not rendered as normal.
- [ ] Throttled and offline e2e variants are green for the critical journeys.
- [ ] All new strings are in `en` and `ja`; axe passes on every new state.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:all
pnpm test:e2e
pnpm test:e2e --project=slow-3g
pnpm test:e2e --project=offline
```

## Out of scope

Backend shedding, backpressure, per-tenant fairness, and zero-downtime restarts (backend TASK-023). The
status page and maintenance banners (TASK-025). Quota limit-reached states, which are a commercial wall
rather than an outage (TASK-026).

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
