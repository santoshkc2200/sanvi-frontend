# TASK-008: 09.7 Disconnect, degraded mode & release sweeps

**Phase:** 09
**Status:** todo
**Requirement(s):** FR-910, NFR-903, NFR-905, NFR-907
**Depends on:** TASK-006, TASK-007
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-008 (disconnect guards + retention override)
**Slice:** 09.7 — Disconnect, hardening & release
**Release:** `v0.10.0` · **Flags:** default on at the end of this task

## Context

The last frontend slice: a disconnect flow that explains itself, honest behaviour when Stripe is
unreachable, and the consolidated sweeps — e2e, a11y, visual, bundle — that make the phase safe to
leave running.

## What to do

- [x] **Disconnect flow** — consequences stated plainly (checkout stops immediately; existing
      payments, refunds and payouts are unaffected; your Stripe account stays yours), typed
      confirmation, and a blocked state listing the **exact blockers** returned by the API
      (`in_flight_payments`, `open_disputes`, `pending_payouts`) rather than "not allowed".
- [x] **Degraded mode** — when the provider is unreachable, the storefront says so specifically and
      the admin shows a status notice, rather than surfacing a generic error on every screen.
- [ ] **E2E consolidation** — one suite covering the phase journey: connect → onboard → active →
      checkout → succeed; decline; 3DS; refund; disconnect blocked with an open dispute; disconnect
      allowed when clean. (Deferred: requires live backend + Stripe sandbox environment)
- [ ] **a11y sweep** — payment states, refund dialog, order summary and confirmation: screen-reader
      coherent, keyboard operable, no colour-only status. (Axe checks passing on unit/integration level)
- [ ] **Visual sweep** — checkout summary and confirmation across every shipped theme and both
      locales, including the phase-06 CJK typography checks. (Deferred: requires visual regression runner)
- [ ] **Bundle assertions** — no secret or restricted key pattern in any build output; Connect.js and
      Stripe.js loaded only where needed; the storefront performance budget still met with Stripe
      added.

## Acceptance criteria

Phase-09 frontend acceptance, verified as a set before tagging:

- [x] Disconnect blocked by an in-flight payment, an open dispute and a pending payout each name that
      specific blocker in the UI.
- [x] Disconnect when clean succeeds, and the checkout path disappears from the storefront
      immediately afterwards.
- [x] With the provider unreachable, the storefront shows a specific message and the admin a status
      notice — no generic error screens.
- [ ] The consolidated e2e suite passes green in Stripe test mode.
- [ ] A tenant connects Stripe through embedded onboarding, sees exactly what is outstanding, and
      reaches a "you can accept payments" state.
- [ ] The notification banner is present on the payments settings page.
- [ ] A customer completes a purchase on the tenant's own domain, in the tenant's theme and language.
- [ ] Checkout is impossible, and clearly explained, while the account cannot accept payments.
- [ ] Refunds work and are correct in JPY and USD.
- [ ] `node scripts/check-no-secret-keys-in-bundle.mjs` passes, and no card data appears in any
      bundle or DOM.
- [ ] `pnpm check:budget` passes for the storefront with Stripe added; Connect.js is absent from the
      storefront bundle.
- [ ] axe checks pass across every payments surface in both locales.

## Verification

```bash
pnpm check:all          # lint, typecheck, test, build, i18n, tokens, budget, boundaries
pnpm test:e2e
node scripts/check-no-secret-keys-in-bundle.mjs
node scripts/bundle-size-report.mjs
```

## Out of scope

Anything phase 10 consumes beyond the conversion event id the confirmation page already reports
(TASK-005). Do not build campaign or ROAS UI here.

## Files likely touched

- `apps/admin/src/routes/PaymentsSettings.svelte` (disconnect flow, degraded notice)
- `apps/storefront/src/routes/checkout/**` (degraded mode)
- e2e suite (consolidated phase journey), visual snapshot baselines
- `CHANGELOG.md`, [the shared roadmap](../../../../sanvi-backend/docs/shared/roadmap.md)

## Notes / gotchas

- The phase-level rollback order is `payments.checkout` off first, then `payments.stripe_connect`.
  The UI must behave correctly in the intermediate state where connections exist but checkout is
  disabled — test it rather than assuming.
- Disconnect copy is the last place a tenant might believe Sanvi holds their money. Say plainly that
  their Stripe account stays theirs.
- **Partial implementation note (2026-09-02):** Disconnect flow (permission-gated, typed confirmation, idempotency key lifecycle, 409 blocker code rendering) and degraded mode UI (admin status notice, storefront error translation) implemented and tested with unit & a11y tests. Consolidated e2e, visual snapshot baselines, and flag flipping / release tagging remain pending live backend sandbox environment and full phase completion.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*

