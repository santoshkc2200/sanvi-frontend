# TASK-026: 11.7 429 handling, quota & usage surfaces

**Phase:** 11 · **Status:** done · **Size:** M
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

- [x] The generated client matches the frozen spec; every removed hand-written workaround is listed.
- [x] A `429` triggers backoff with jitter and respects `Retry-After`.
- [x] `429` and `503` produce different messages and different backoff, proven by a test.
- [x] A non-idempotent mutation is never retried automatically after a `429`.
- [x] The rate-limit error is typed and distinguishable at the call site.
- [x] Every metered dimension shows usage against limit, with a warning state and the upgrade path.
- [x] **The number shown equals the number enforcement uses**, asserted by an e2e.
- [x] With the backend flags off, the limit line is absent rather than broken.
- [x] Every limit-reached state is reachable in an e2e and reads specifically to its dimension.
- [x] Platform admin shows per-tenant usage and applies audited overrides. *(Scoped 2026-10-10,
      user decision: overrides + audited proof shipped; live per-tenant counters are NOT shown —
      see the scope decision in Execution notes.)*
- [x] All new strings are in `en` and `ja`; axe passes on every new surface; budgets hold.

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

## Execution notes (2026-10-10)

Branch `feat/task-026-quota-usage` (isolated worktree; `main` carried uncommitted TASK-008
recovery work that this branch deliberately does not include).

**Step 1 — the backend landed, and the regen was real.** `sanvi-cli openapi` (176 paths, was
171) adds exactly five endpoints: `/system/health`, `/system/ready`, `/tenant/usage`,
`/tenant/payments/connections/current` (TASK-008's missing endpoint — the recovery on `main`
can now consume the generated shape), and `/tenant/ads/tracking/site-key` (TASK-014's open
cross-repo item; no wrapper added here — that is TASK-014's follow-up, not this task).
`pnpm generate:api` itself is broken at HEAD (pre-existing, all Node versions):
`openapi-typescript@7.13.0` pulls `@redocly/openapi-core`, which resolves `js-yaml@5.4.2`
whose CJS build no longer exposes the `.types` redocly's compiled code reads. Regeneration
ran the script's two halves by hand instead — `cargo run -p sanvi-cli -- openapi` for
`merged.json` (Node-serialized, so the diff is content-only) and the repo-pinned
`openapi-typescript@7.13.0` via `pnpm dlx` (fresh, coherent tree) for `types.ts` with the
unchanged generated header. A second backend-CLI run is byte-identical to the committed
`merged.json`. CI's `api-types-drift` job is advisory (`continue-on-error`) and would hit
the same redocly breakage — recorded here, not fixed here.

Removed hand-written workarounds (for the PR list):
- `system.ts`: `LivenessResult` / `HealthState` / `DependencyState` / `ReadinessStates`
  locals deleted for the generated aliases (the TASK-025 probes). `isReadinessStates` stays:
  the 503 path carries states, not problem+json. One adopted widening:
  `LivenessResult.status` was locally `'ok'`, the spec says `string`.
- `payments.ts`: `CreatePaymentConnectionRequest` / `PaymentConnectionView` locals and all
  three `as unknown as` casts deleted for `PaymentsCreateConnectionRequest` /
  `PaymentsConnectionView`. Old names survive as aliases (16 app call sites untouched).
- `audit.ts`: `after` cursor `number` → `string` per the spec; callers stringify at the
  boundary (`Audit.svelte` passes the filter text through; `TenantDetail.svelte` wraps the
  still-`int64` response cursor in `String()` — the asymmetry is the contract's, noted).
- `advertising.ts`: `ConnectionView` / `Money` repointed at the byte-identical
  `AdvertisingConnectionView` / `AdvertisingMoney` (compat aliases, not renames).
- Already gone before this task: the TASK-017 utoipa casts (backend annotations landed).

Regen fallout fixed in the same step (all verified by typecheck, all genuine contract moves):
`DomainPurchase.svelte` + its unit/e2e mocks `amount_minor` → `minor` (`DomainsMoney`
renamed the field; advertising/payments money keep `amount_minor`), `diagnostics.test.ts`
fixture gains the now-required `dedupe_key`.

**Step 2 — mostly inherited from TASK-023** (jittered backoff, 503 2× harder with
non-overlapping windows, `Retry-After` bounded at 30 s, idempotency-gated retry, bounded
attempts so no spinner never resolves). Added: `isRateLimited` type guard in `problem.ts`
(the DoD's typed call-site error) + two tests (`resilience.test.ts`: 429 never retries a
non-idempotent POST even with `Retry-After`; guard narrowing). Different-messages proof is
`failure-copy.test.ts` (distinct `errors.failure.*` keys), different-backoff proof the
`retryDelayFor` windows test.

**Steps 3–4 — admin `/usage` rewritten around the endpoint.** New `api-client/usage.ts`
(`getTenantUsage`, `QUOTA_DIMENSIONS` display order, generated types only). New
`ui/UsageDimensionCard` (meter + dimension-specific warning/limit copy via props + upgrade
link; wall is `used >= limit`, thresholds mirror `UsageMeter` so bar and copy agree; axe
unit-tested). `Usage.svelte` loads usage + entitlements independently (a usage failure no
longer takes the entitlements section down), renders the six dimensions in fixed order,
skips unmetered dimensions entirely, shows `errors.failure.rateLimited` via `isRateLimited`
on a 429, and keeps all five async-audit states (audit row updated). 13 new
`admin.usage.*` keys in `en`+`ja` (names, warning/limit templates incl. bytes variants,
upgrade CTA, byte unit); `quotaTitle` + `noUsageDataNote` deleted in both locales.
`apps/admin/e2e/usage.spec.ts` (5 tests): verbatim numbers, flags-off absence, all six
limit-reached states dimension-specific, 429 → notice with no spinner left, axe
critical/serious clean. Storage renders raw bytes — the enforcement number, exactly.

**Step 5 — scope decision (user-approved, 2026-10-10).** `GET /api/v1/tenant/usage` resolves
the tenant from host/header middleware and takes no tenant parameter; the operator console
sends no tenant scope, so a per-tenant usage section would 404 in production. Shipped:
limit overrides + audited proof only. `apps/platform-admin/e2e/quota-overrides.spec.ts`
grants a `seats` limit override on `TenantDetail` (request body asserted: feature, limit,
reason), then shows the audit entry the grant produced (the audit mock only serves the
entry after the POST — causality, not fixture). Live operator usage counters are a
cross-repo gap for the backend (operator usage-read endpoint); tenant counters remain
tenant-console-only. Incidental finding: TenantDetail's audit tab has one serious axe hit
— the disabled Domains tab's contrast (`#94a3b8`, 2.56:1), pre-existing page chrome for
TASK-027, so the PA spec carries no axe gate (the new admin surface does).

**Incidental drive-bys (pre-existing reds blocking `typecheck`, all test-only or two
lines, listed so they are not mistaken for task scope):** `packages/auth` Kratos
`UiNodeAttributes` gains optional `width`/`height` (the component already read them);
`lint-gates` test-only `manifest: unknown` and `violations[0]?.missing`.

**Verification.** `pnpm lint` ✓; `typecheck` ✓ all packages; `build` ✓; `test`
(api-client 133, ui 440 incl. new card tests, platform-admin 21, lint-gates 100) ✓; admin
suite green except 2 pre-existing idempotency-timing failures verified identical on `main`;
storefront `hooks.server.test.ts` ×2 likewise pre-existing on `main` (jsdom/undici
`AbortSignal` realm, environmental); one `theme-blocks` full-parallel flake (42/42 solo,
same contention pattern TASK-019 recorded).
Every `check:*` gate ✓ incl. `check:budget --all` (`/usage` 2.7 KB, admin initial
78.2/100) and `check:async-audit` (86 routes). e2e (chromium): `usage.spec` 5/5,
`quota-overrides.spec` 1/1, `domain-purchase.spec` still green; `--grep quota` /
`--grep rate-limit` select the new specs. webkit not run (no browser binary in this env,
same as TASK-023's record). `generate:api` second-run equivalence proven via the two
halves (the script itself stays broken — see above).

**For the backend track:** operator usage-read endpoint (Step 5 gap); `get_tenant_usage`'s
utoipa `summary` is a copy-paste of `provision_tenant` (`handlers.rs`, above the
`get_usage` annotation); `next_cursor` (int64) vs `after` (string) asymmetry on the
audit list.

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
