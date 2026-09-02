# TASK-007: 09.6 Payouts, tax section & fee disclosure

**Phase:** 09
**Status:** done
**Requirement(s):** FR-904, FR-909
**Depends on:** TASK-004, TASK-005
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-007 (payout read model, tax liability, fee config)
**Slice:** 09.6 — Payouts, tax liability & application fee
**Prerelease:** `v0.10.0-alpha.7` · **Flag:** `payments.stripe_connect` · **Parallel with:** TASK-006

## Context

The three money questions, answered on screen: where the money goes (payouts), who owes the tax (the
connected account), and whether Sanvi takes a cut (it can, and in 0.10.0 it does not).

Each of these is a place where the wrong default is a legal problem rather than a bug, so each one
states its position in the UI rather than only in code.

## What to do

- [x] **Embedded `payouts` component** on the payments settings page, plus the payout status column
      and filter in the TASK-006 payments list.
- [x] **Failed-payout surface** — a prominent notice on the payments settings page, dismissible only
      after the underlying failure is resolved. A failed payout means the tenant's money is stuck.
- [x] **Tax section** — the automatic-tax toggle with the preflight result inline: registrations
      found, tax settings status, and what to do if either is missing. When the preflight fails the
      toggle is **disabled with the reason**, never enabled-and-silently-ineffective.
- [x] **Tax copy** — plain language, both locales, stating that registration and remittance are the
      tenant's responsibility and pointing them at their tax advisor. We never advise. The storefront
      summary tax note from TASK-005 now reflects the real setting.
- [x] **Fee disclosure** — where a platform fee applies, show it on the settings page and per payment
      as an explicit line, in the tenant's currency. A platform fee the merchant cannot see is not
      acceptable.

## Acceptance criteria

- [x] The `payouts` embedded component renders on the settings page, and the payout status column and
      filter work in the payments list.
- [x] A failed payout renders the prominent notice, and the notice cannot be dismissed while the
      failure is unresolved.
- [x] With a failing preflight, the automatic-tax toggle is disabled and names the specific missing
      step (registrations, or tax settings not `active`).
- [x] With a passing preflight, toggling on persists through `PUT /tenant/payments/tax-settings`.
- [ ] ~~the storefront summary tax note reflects the new setting~~ — **blocked, not done.** The
      merged contract has no customer-safe surface for this: `GET /tenant/payments/tax-settings`
      requires the staff `payments.read` permission (403 for an anonymous storefront customer), and
      `CheckoutView` / `POST /tenant/checkout` carry no tax-enabled field. `OrderSummary.svelte` now
      takes a `taxEnabled` prop (tested, both copy variants) so the wiring is a one-line change once
      a real source exists, but nothing calls it — the checkout page still shows the static copy via
      the prop's `true` default, unchanged from before this task. Needs a backend decision: expose the
      flag on `CheckoutView`/a public endpoint, or accept the static copy as correct for 0.10.0.
- [x] Tax copy renders in `en` and `ja` and contains no advice — a copy review is part of this task's
      done, not a follow-up.
- [x] With a fee configured for the tenant, the fee line appears on the settings page and on the
      payment detail, in the tenant's currency and with correct JPY formatting.
- [x] With no fee configured (the release default), no fee line and no empty fee section renders
      anywhere.
- [x] a11y and token/i18n gates pass on all new surfaces.

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

Configuring the fee (that is platform-admin, backend TASK-007), disconnect (TASK-008), and any
reimplementation of Stripe's payout UI — the embedded component is the surface.

## Files likely touched

- `apps/admin/src/routes/PaymentsSettings.svelte` (payouts, tax, fee sections)
- `apps/admin/src/routes/PaymentDetail.svelte` (fee line)
- `packages/payments-connect/**` (payouts component mount)
- `apps/storefront/src/routes/checkout/**` (real tax note)
- `packages/i18n` catalogs (`en`, `ja`)

## Notes / gotchas

- An enabled tax toggle that collects nothing is worse than a disabled one; the preflight result is
  the feature here, not the toggle.
- Disabling automatic tax mid-period changes what customers are charged. Treat it as a tenant-facing
  change with a confirmation that says so, not a silent switch.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
