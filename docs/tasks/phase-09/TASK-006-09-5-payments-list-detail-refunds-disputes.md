# TASK-006: 09.5 Payments list, detail, refunds & disputes

**Phase:** 09
**Status:** todo
**Requirement(s):** FR-907, FR-908, NFR-905, NFR-908
**Depends on:** TASK-005
**Created:** 2026-08-20

**Sub-phase:** [09.5 — Payments, refunds & disputes](../../../../docs/phase-09-tenant-payments/09.5-payments-refunds-disputes.md)
**Prerelease:** `v0.10.0-alpha.6` · **Flag:** `payments.checkout` · **Parallel with:** TASK-007

## Context

The tenant-side view of money that has moved: every payment, a refund action, and dispute visibility.

The refund dialog is the most dangerous UI in the phase. It is irreversible, arithmetic-sensitive and
currency-sensitive, so it shows the exact amount in the exact currency and the remaining refundable
balance **before** submission, and submits exactly once.

## What to do

- [ ] **Payments list** (`apps/admin`) — date, customer, amount, status, method, payout status;
      filters matching the API (date range, status, customer, currency); cursor pagination; CSV
      export. Amounts formatted with the TASK-001 money helpers.
- [ ] **Payment detail** — the API's timeline projection rendered as-is (do not re-derive it in the
      UI), the refund action, and dispute state with a Stripe Dashboard deep link.
- [ ] **Refund flow** — permission-gated on `payments.refund`, full or partial, reason required. The
      confirmation dialog shows the **exact amount in the exact currency** and the remaining
      refundable balance before submission; JPY shows no decimals anywhere in the flow. The submit
      button disables after the first click, and the request carries an idempotency key generated once
      per dialog open — not per attempt.
- [ ] **Dispute display** — read-only, with the response deadline prominent and copy explaining that
      the response is submitted in Stripe, not here.
- [ ] **Empty states that teach** — before the first payment the page explains what will appear here
      and links to the settings page if the connection is not active yet.

## Acceptance criteria

- [ ] The list renders real sandbox data with every documented filter and cursor pagination working.
- [ ] CSV export downloads the documented column set and is scoped to the current tenant.
- [ ] A role without `payments.refund` sees no refund button (and the API returns 403 if called
      directly).
- [ ] The refund dialog's displayed amount, currency and remaining balance match the API for a
      sequence of partial refunds, in both JPY and USD.
- [ ] Double-submitting the dialog issues exactly one refund — the idempotency key is stable for the
      dialog's lifetime.
- [ ] A refund issued in the tenant's Stripe Dashboard appears in the list without manual
      intervention.
- [ ] Dispute state renders with the deadline and a working deep link, and no evidence UI exists.
- [ ] a11y: the refund dialog is keyboard-operable, focus-trapped, and the confirmation amount is
      announced; axe checks pass on list, detail and dialog.
- [ ] The empty state renders before the first payment and links to settings when inactive.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:i18n
pnpm check:tokens
pnpm check:boundaries
pnpm test:e2e --filter admin
```

## Out of scope

The payout status column's data source and the `payouts` embedded component (TASK-007), fee
disclosure per payment (TASK-007), and any dispute-evidence submission at all.

## Files likely touched

- `apps/admin/src/routes/Payments.svelte`, `PaymentDetail.svelte`, refund dialog component
- `packages/api-client/src/payments.ts` (list, detail, refund, disputes, export)
- `packages/billing-elements/src/**` (money formatting reuse)
- `packages/i18n` catalogs (`en`, `ja`)

## Notes / gotchas

- Generate the idempotency key **once per dialog open**. A key regenerated per attempt defeats the
  entire point and can double-refund a tenant's customer.
- Tenants have `dashboard: "full"` and will refund outside our UI. The list must reconcile, so do not
  build any UI state that assumes we are the only source of refunds.

---
*On completion: satisfy every acceptance criterion, run the verification commands,
then record status with the sdlc-planner script (never by hand-editing this line
and the backlog separately):*
`sdlc.py status TASK-006 done --note "<PR or commit>"`
