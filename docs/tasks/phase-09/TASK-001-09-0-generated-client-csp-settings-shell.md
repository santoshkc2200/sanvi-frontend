# TASK-001: 09.0 Generated client, CSP & settings shell

**Phase:** 09
**Status:** done
**Requirement(s):** NFR-902, NFR-903, NFR-908
**Depends on:** phase 08
**Created:** 2026-08-20

**Slice:** 09.0 — Contract, schema & foundations
**Prerelease:** `v0.10.0-alpha.1` · **Flag:** `payments.enabled` (off)

## Context

The frontend half of the foundations slice. Nothing user-visible ships: this task proves the contract
pipeline end to end against the empty catalog endpoint, puts the Stripe origins into the shared CSP
builder before any Stripe code exists, and lands an entitlement-gated shell page for later slices to
fill in.

Doing the CSP now, in the shared package, is what stops the storefront and the admin from drifting
apart later — a per-app policy added under time pressure in TASK-003 is how `unsafe-inline` gets in.

## What to do

- [ ] **Generated client** — regenerate `packages/api-client` from the backend's new `payments.yaml`
      (`pnpm generate:api`). The empty catalog endpoint proves the pipeline end to end.
- [ ] **CSP** — add Stripe origins to `packages/csp`: `https://js.stripe.com` and
      `https://*.stripe.com` in `script-src`, `frame-src` and `connect-src`. Added to the shared
      builder as a named preset (`stripe()`), never ad-hoc per app, so the storefront and admin cannot
      drift. A unit test asserts the preset produces no `unsafe-inline` widening.
- [ ] **Admin shell page** — `apps/admin/src/routes/PaymentsSettings.svelte`, registered in the SPA
      router and entitlement-gated: `UpgradePrompt` without the entitlement, an empty state with it.
      No Stripe code yet.
- [ ] **Money formatting** — extend the `packages/billing-elements` money helpers (present since phase
      04) with tenant-currency formatting and a zero-decimal guard, unit-tested against JPY and USD.
      TASK-005 through TASK-007 reuse these rather than reinventing formatting per screen.
- [ ] **Bundle key scan** — wire `scripts/check-no-secret-keys-in-bundle.mjs` into the pipeline so a
      `sk_`/`rk_` pattern in any build output fails CI from the start of the phase, not at the end.

## Acceptance criteria

- [ ] `pnpm generate:api` produces a payments client and `pnpm typecheck` passes against it.
- [ ] The CSP snapshot test for both the admin and the storefront includes the Stripe origins in
      `script-src`, `frame-src` and `connect-src`, and contains no `unsafe-inline`.
- [ ] The payments settings route renders `UpgradePrompt` without the entitlement and an empty state
      with it; no Stripe script is loaded on either path.
- [ ] The money helper formats JPY with no decimals and USD with two, and rejects a partial amount
      larger than the total at the type boundary.
- [ ] `node scripts/check-no-secret-keys-in-bundle.mjs` runs over a real build and exits 0.
- [ ] `pnpm check:i18n` and `pnpm check:tokens` pass — the shell page has no hardcoded strings or
      colours.

## Verification

```bash
pnpm install
pnpm generate:api
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:i18n
pnpm check:tokens
pnpm check:boundaries
node scripts/check-no-secret-keys-in-bundle.mjs
```

## Out of scope

The provider catalog UI and `PaymentProviderCard` (TASK-002), Connect.js and any embedded component
(TASK-003), and everything storefront-side (TASK-005).

## Files likely touched

- `packages/api-client/src/payments.ts`, `packages/api-client/src/generated/types.ts`
- `packages/csp/src/index.ts` + tests
- `apps/admin/src/routes/PaymentsSettings.svelte`, the admin router
- `packages/billing-elements/src/**` (money helpers)
- `scripts/check-no-secret-keys-in-bundle.mjs`, CI workflow

## Notes / gotchas

- `billing-elements` stays the Stripe **Elements** package for platform billing. Do not put Connect.js
  in it — that is a separate package in TASK-003.
- Rollback is flag-off; nothing here has an external side effect.

---
*On completion: satisfy every acceptance criterion, run the verification commands,
then record status with the sdlc-planner script (never by hand-editing this line
and the backlog separately):*
`sdlc.py status TASK-001 done --note "<PR or commit>"`
