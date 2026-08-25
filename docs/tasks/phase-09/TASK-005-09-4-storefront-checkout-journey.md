# TASK-005: 09.4 Storefront checkout journey

**Phase:** 09
**Status:** todo
**Requirement(s):** FR-905, FR-906, NFR-901, NFR-905
**Depends on:** TASK-004
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-005 (checkout session on the connected account)
**Slice:** 09.4 — Checkout on the connected account (direct charges)
**Prerelease:** `v0.10.0-alpha.5` · **Flag:** `payments.checkout`

## Context

A customer buys something on the tenant's own domain, in the tenant's theme and language, and the
money is the tenant's. This is the slice the phase exists for on the customer side.

The rule that governs every state on this page: **the webhook is the fact, the redirect is a hint.**
Order state comes from our API, never from the return URL.

## What to do

```
order summary (themed, localized, tax note)
  → POST /api/v1/tenant/checkout        (our API; creates the session on the connected account)
  → redirect to Stripe Checkout         (locale from phase 06, branding from the connected account)
  → return to the tenant's own domain   (phase 08)
  → "confirming your payment" state, polling GET /api/v1/tenant/checkout/{id}
  → confirmation page: what was bought, receipt, next steps
```

- [ ] **Order summary** (`apps/storefront`) — themed with phase-07 tokens, localized with phase-06
      catalogs, with a tax note driven by the tenant's tax settings from TASK-007 (a static "tax may
      apply" note until then).
- [ ] **Checkout initiation** — POST to our API with an idempotency key generated per attempt; the
      button is disabled with the **reason shown** while the connection cannot accept payments.
- [ ] **Redirect → return** — the return lands on the tenant's own domain, shows a *confirming your
      payment* state, and polls with backoff. Webhook lag must hold the confirming state and must
      never render a false failure. Set a generous ceiling, then show *taking longer than usual, we'll
      email you* — never *payment failed*.
- [ ] **Confirmation page** — what was bought, the amount in the right currency, the receipt, next
      steps. Idempotent: a refresh or a stale success URL does not create or re-report an order. The
      server-issued conversion event id is reported once; it is the conversion source for phase 10.
- [ ] **Cancel path** — returns to the summary with the cart intact.
- [ ] **Failure states** — specific, not generic: *your card was declined — try another method*, *the
      payment expired — start again*, *this store can't accept payments right now*. Map decline codes
      to messages; the fallback is honest rather than blaming the customer.
- [ ] **CSP** — verify the storefront runs with the TASK-001 Stripe preset and no per-page relaxation.

## Acceptance criteria

- [ ] E2E in Stripe test mode: a purchase on a tenant's own domain completes and the confirmation
      renders from API state.
- [ ] Webhook-delay resilience: a delayed webhook holds the confirming state and never shows a false
      failure.
- [ ] Returning to a stale success URL produces no duplicate order and no second conversion report.
- [ ] The 3DS/SCA path, the decline path, the expired-session path and the cancel path each show
      their own specific message.
- [ ] The buy button is disabled with a visible reason while the connection cannot accept payments.
- [ ] A JPY purchase renders with no decimals at every step of the flow.
- [ ] Visual snapshots pass for the summary and confirmation across every shipped theme and both
      locales.
- [ ] a11y: the summary, confirming state and confirmation are screen-reader coherent, keyboard
      operable, and never colour-only; axe checks pass.
- [ ] The storefront CSP snapshot is unchanged from TASK-001 — no page-level relaxation was added.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:i18n
pnpm check:tokens
pnpm check:budget
pnpm check:boundaries
pnpm test:e2e --filter storefront
node scripts/check-no-secret-keys-in-bundle.mjs
```

## Out of scope

The tenant-side payments list and refunds (TASK-006), the real tax note wiring (TASK-007), and
degraded-mode messaging beyond the "can't accept payments right now" state (TASK-008).

## Files likely touched

- `apps/storefront/src/routes/checkout/**` (summary, return, confirming, confirmation, cancel)
- `packages/api-client/src/payments.ts` (checkout create + poll)
- `packages/i18n` catalogs (`en`, `ja`) — decline-code messages
- storefront e2e specs, visual snapshots

## Notes / gotchas

- Never derive order state from the return URL. A customer who never returns must still get a paid
  order, and a forged return URL must yield nothing.
- The confirming state's ceiling should be generous. Showing *payment failed* to a customer whose
  money has left their account is the worst outcome available on this page.
- Connect.js has no place in this bundle; the storefront uses hosted Stripe Checkout via redirect.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
