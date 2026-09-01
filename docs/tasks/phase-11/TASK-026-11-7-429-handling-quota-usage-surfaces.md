# TASK-026: 11.7 429 handling, quota & usage surfaces

**Phase:** 11 · **Status:** todo · **Size:** M
**Requirement(s):** FR-1116, FR-1117, NFR-1106, NFR-1109
**Depends on:** TASK-023, **phases 09 and 10 shipped**
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Blocked by (cross-repo):** sanvi-backend TASK-026 (spec freeze, `429` semantics, `GET /api/v1/tenant/usage`)
**Flags:** `platform.rate_limits`, `platform.quotas` (backend-owned)

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Handle `429` once for all four apps, and show tenants the limits they are working against before they
hit them.

## Why this shape

**This task carries the phase's single permitted new user-facing capability.** Everything else improves
or proves what exists; usage and quota surfaces are new, justified by one observation: a limit users
cannot see is a support ticket with extra steps.

`429` handling lives in `packages/api-client` rather than per app, because **four apps each getting
backoff subtly wrong is four different bug reports with one root cause.** `429` and `503` mean
different things — you asked too often versus we are too busy — so they get different backoff and
different copy.

Regenerating the client from the frozen spec is also the proof the backend's consistency pass worked:
**every hand-written workaround that can now be deleted is one inconsistency that is really gone.**

## Constraints

- **The number shown must be the number enforcement uses.** Do not compute a "close enough" client-side
  estimate to avoid a request; it will disagree at exactly the moment the user is looking at it.
- With the backend flags off, usage renders with no limit line. Design the warning and limit-reached
  states to be **absent rather than broken** when no limit is configured.
- These screens are the phase's only new UI, which makes them the only place scope creep can enter. **A
  usage graph over time is not in scope**; a number, a limit, and a warning threshold are.

## File ownership map

- `packages/api-client/**` — regenerated types, `429` policy, typed rate-limit error
- `apps/admin/src/routes/usage/**` — usage dashboard, warning states
- `packages/ui/**` — limit-reached state primitives per dimension
- `apps/platform-admin/**` — per-tenant usage, audited overrides
- `packages/i18n` catalogs (`en`, `ja`)

## Steps

### Step 1: Regenerate the client from the frozen spec

**Files:** Modify `packages/api-client/**`

**Do:** regenerate, then delete the hand-written workarounds that accumulated while shapes were still
moving.

**Verify:** `pnpm generate:api` produces no diff on a second run; **every removed workaround is listed
in the PR**.

### Step 2: Handle `429` once, in the client

**Files:** Modify `packages/api-client/**`

**Do:** respect `Retry-After`, back off with jitter, expose a **typed** rate-limit error distinguishable
from every other error at the call site, and **never automatically retry a non-idempotent mutation**.

**Verify:**
- A `429` triggers backoff and respects `Retry-After`; it never produces a spinner that never resolves.
- A test asserts `429` and `503` produce different messages and different backoff.
- A test asserts a non-idempotent mutation is never retried automatically after a `429`.

### Step 3: Build the usage surface

**Files:** Create `apps/admin/src/routes/usage/**`; Modify `packages/i18n`

**Do:** current usage against limit per metered dimension — API requests, tracked conversions, storage,
custom domains, seats, notification sends — with a warning threshold before the wall and the upgrade
path inline.

**Verify:** an e2e asserts the number rendered equals the number `GET /api/v1/tenant/usage` returns, and
that with the backend flags off the limit line is absent rather than broken.

### Step 4: Design a limit-reached state per dimension

**Files:** Modify `packages/ui/**`; Modify `packages/i18n`

**Do:** a blocked upload reads differently from a blocked API call. Each names the limit, the reset
time, and the upgrade action.

**Verify:** every limit-reached state is reachable in an e2e and reads specifically to its dimension.

### Step 5: Add the platform-admin view

**Files:** Modify `apps/platform-admin/**`

**Do:** per-tenant usage and limit overrides, with overrides audited.

**Verify:** an e2e applies an override and asserts an audit entry is produced.

## Definition of done

- [ ] The generated client matches the frozen spec; every removed hand-written workaround is listed.
- [ ] A `429` triggers backoff with jitter and respects `Retry-After`.
- [ ] `429` and `503` produce different messages and different backoff, proven by a test.
- [ ] A non-idempotent mutation is never retried automatically after a `429`.
- [ ] The rate-limit error is typed and distinguishable at the call site.
- [ ] Every metered dimension shows usage against limit, with a warning state and the upgrade path.
- [ ] **The number shown equals the number enforcement uses**, asserted by an e2e.
- [ ] With the backend flags off, the limit line is absent rather than broken.
- [ ] Every limit-reached state is reachable in an e2e and reads specifically to its dimension.
- [ ] Platform admin shows per-tenant usage and applies audited overrides.
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

The spec consistency pass, the freeze gate, enforcement, deprecation machinery, and the replay suite
(backend TASK-026). Outage and degraded states, which are not limits (TASK-023).

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
