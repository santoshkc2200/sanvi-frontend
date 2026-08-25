# TASK-023: 11.4 Error boundaries, outage UX, retry & offline

**Phase:** 11
**Status:** todo
**Requirement(s):** FR-1111, FR-1112, FR-1113, NFR-1105
**Depends on:** TASK-021
**Created:** 2026-08-21

**Blocked by (cross-repo):** sanvi-backend TASK-023 (`503 platform/overloaded` + `Retry-After`, degraded-mode header)
**Slice:** 11.4 — Resilience, graceful degradation & zero-downtime deploys
**Prerelease:** `v1.0.0-rc.5` · **Flag:** `platform.degraded_mode` (backend-owned)

## Context

The backend decides what the system *does* when a dependency fails. This task decides what the user
*sees* — and the bar is that during a chaos drill users see a **designed experience**, not an incidental
toast on top of a blank panel.

Two rules shape everything here. **Nothing spins forever**: every async surface has a timeout and a
terminal state, and the route-by-route audit that produces that list also feeds TASK-027's acceptance
criterion. And **honesty over reassurance**: a degraded response says it is degraded, stale content says
what is stale, and a non-idempotent action that might have succeeded asks rather than silently retrying.

## What to do

- [ ] **Contract** — consume two backend additions: `503` with `Retry-After` and the
      `platform/overloaded` problem type (distinct from TASK-026's `429` — different backoff, different
      message), and the degraded-mode response header that tells this repo when to say so.
- [ ] **Error boundaries per route** — with a recovery action and TASK-020's trace id, never a blank page
      and never a full-app crash from one panel.
- [ ] **Backend-outage experience per app** — storefront serves cached content where possible and says
      what is stale; admin explains the outage and offers retry; marketing is static and unaffected;
      platform-admin surfaces the incident directly. **Designed screens, reviewed with design**, not
      incidental toasts.
- [ ] **No infinite spinners** — every async surface gets a timeout and a terminal state. A
      route-by-route audit produces the list; each entry gets loading, empty, error, and success states.
- [ ] **Retry UX** — exponential backoff with jitter, a manual retry affordance, and honest labelling:
      idempotent mutations retry silently, non-idempotent ones ask. `Retry-After` from a `503` is
      respected rather than ignored.
- [ ] **Offline handling** — detection, a queue for actions that are safe to defer, and honest messaging
      for those that are not. **Nothing is queued that could execute twice.**
- [ ] **Slow-network e2e** — 3G-throttled runs of the critical journeys per app added to the suite, plus
      an offline variant for the storefront.

## Acceptance criteria

- [ ] Every route renders a designed state with the API returning 500, 503, and a timeout — asserted per
      route, not sampled.
- [ ] Every async surface has loading, empty, error, and success states; **no infinite spinner remains**,
      proven by the committed route-by-route audit.
- [ ] An error boundary contains a panel-level failure without taking down the app, and shows a recovery
      action plus the trace id.
- [ ] A simulated total backend outage produces a designed, honest experience in all four apps.
- [ ] `Retry-After` from a `503` is respected; a `429` and a `503` produce different messages and
      different backoff.
- [ ] Idempotent mutations retry silently; non-idempotent ones ask before retrying, proven by a test.
- [ ] The offline queue never double-submits, proven by a test that replays a queued action after
      reconnect.
- [ ] A degraded-mode response is surfaced to the user as degraded, not rendered as normal.
- [ ] Slow-network (3G) and offline e2e variants are green for the critical journeys.
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

Backend shedding, backpressure, per-tenant fairness, chaos drills, and zero-downtime deploys (backend
TASK-023). The status page and maintenance banners (TASK-025). Quota limit-reached states, which are a
commercial wall rather than an outage (TASK-026).

## Files likely touched

- each app's route-level error boundaries and outage screens
- `packages/api-client/**` (backoff with jitter, `Retry-After`, idempotency-aware retry policy)
- `packages/ui/**` (async state primitives with timeouts, degraded banner surface)
- offline detection and the safe-action queue
- `packages/i18n` catalogs (`en`, `ja`) — outage, retry, stale-content, and offline copy
- e2e specs (slow-3g and offline projects), `docs/ux/async-state-audit.md`

## Notes / gotchas

- Rollback: these are additive states; a route without a designed outage screen falls back to the generic
  boundary rather than to a blank page. The backend's `platform.degraded_mode` off makes degraded paths
  fail loudly, which this repo renders as an ordinary error — correct, if less kind.
- The async-state audit is a deliverable, not scaffolding: TASK-027 reuses it as its route inventory, and
  a sampled audit produces a sampled accessibility pass.
- "Safe to defer" is a narrower set than it looks. If a queued action cannot be made idempotent, it is
  not queueable — say so honestly rather than queueing it and hoping.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
