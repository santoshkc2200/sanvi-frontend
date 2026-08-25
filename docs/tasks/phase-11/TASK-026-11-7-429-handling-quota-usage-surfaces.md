# TASK-026: 11.7 429 handling, quota & usage surfaces

**Phase:** 11
**Status:** todo
**Requirement(s):** FR-1116, FR-1117, NFR-1106, NFR-1109
**Depends on:** TASK-023
**Created:** 2026-08-21

**Blocked by (cross-repo):** sanvi-backend TASK-026 (spec freeze, `429` semantics, `GET /api/v1/tenant/usage`)
**Slice:** 11.7 — API `v1` freeze, deprecation policy, rate limits & quotas
**Prerelease:** `v1.0.0-rc.8` · **Flags:** `platform.rate_limits`, `platform.quotas` (backend-owned)

## Context

**This task carries the phase's single permitted new user-facing capability.** Everything else in phase
11 improves or proves what exists; usage and quota surfaces are new, and they are justified by one
observation: a limit users cannot see is a support ticket with extra steps.

The `429` handling is shared once in `packages/api-client` rather than per app, because four apps each
getting backoff subtly wrong is four different bug reports with one root cause. `429` and `503` mean
different things — you asked too often versus we are too busy — so they get different backoff and
different copy.

The client regeneration is also the proof that the backend's consistency pass worked: every hand-written
workaround that can now be deleted is one inconsistency that is really gone.

## What to do

- [ ] **Contract** — consume the frozen spec: `429` with `Retry-After`, `RateLimit-Limit`,
      `RateLimit-Remaining`, `RateLimit-Reset`; the documented burst behaviour; and
      `GET /api/v1/tenant/usage` returning current-period usage and limit per metered dimension.
- [ ] **`429` handling in `packages/api-client`** — respect `Retry-After`, back off with jitter, expose a
      **typed** rate-limit error, and **never automatically retry a non-idempotent mutation**. Shared
      once, so four apps cannot each get it subtly wrong.
- [ ] **Quota and usage surfaces** — current usage against limit per metered dimension in tenant admin
      (API requests, tracked conversions, storage, custom domains, seats, notification sends), with a
      warning threshold before the wall and the upgrade path inline.
- [ ] **Limit-reached experiences** — a designed state for each metered dimension (a blocked upload reads
      differently from a blocked API call), each naming the limit, the reset time, and the upgrade action.
- [ ] **Platform-admin view** — per-tenant usage and limit overrides, with overrides audited.
- [ ] **Regenerate the client** from the frozen spec and delete the hand-written workarounds that
      accumulated while shapes were still moving. Each deletion is evidence the consistency pass worked.

## Acceptance criteria

- [ ] A `429` triggers backoff with jitter and respects `Retry-After` — it never produces a spinner that
      never resolves.
- [ ] A `429` and a `503` produce different messages and different backoff, proven by a test.
- [ ] A non-idempotent mutation is never retried automatically after a `429`.
- [ ] The rate-limit error is typed and distinguishable from every other error at the call site.
- [ ] Every metered dimension shows current usage against its limit, with a warning state before the wall
      and the upgrade path inline.
- [ ] **The number shown matches the number enforcement uses** — a UI showing a different number from the
      one that blocks the request is worse than no UI.
- [ ] Every limit-reached state is reachable in an e2e, names the limit, the reset time, and the upgrade
      action, and reads specifically to its dimension.
- [ ] Platform admin shows per-tenant usage and applies limit overrides, with each override audited.
- [ ] The generated client is regenerated from the frozen spec and every removed hand-written workaround
      is listed in the PR.
- [ ] All new strings are in `en` and `ja`; axe passes on every new surface; budgets hold.

## Verification

```bash
pnpm generate:api
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:all
pnpm test:e2e --grep quota
pnpm test:e2e --grep rate-limit
```

## Out of scope

The spec consistency pass, the freeze gate, rate-limit and quota enforcement, the deprecation machinery,
and the replay suite (backend TASK-026). Outage and degraded states, which are not limits (TASK-023).

## Files likely touched

- `packages/api-client/**` (regenerated types, `429` policy, typed rate-limit error)
- `apps/admin/src/routes/usage/**` (usage dashboard, warning states)
- `packages/ui/**` (limit-reached state primitives per dimension)
- `apps/platform-admin/**` (per-tenant usage, audited overrides)
- `packages/i18n` catalogs (`en`, `ja`) — usage, warning, limit-reached, and upgrade copy

## Notes / gotchas

- Rollback: the backend's flags off return to unlimited while the counting path stays live, so these
  surfaces render real usage with no limit line. Design the warning and limit-reached states to be absent
  rather than broken when no limit is configured.
- The usage number and the enforcement counter must be the same number from the same endpoint. Do not
  compute a "close enough" client-side estimate to avoid a request; it will disagree at exactly the
  moment the user is looking at it.
- These screens are the phase's only new UI, which makes them the only place scope creep can enter. A
  usage graph over time is not in scope; a number, a limit, and a warning threshold are.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
