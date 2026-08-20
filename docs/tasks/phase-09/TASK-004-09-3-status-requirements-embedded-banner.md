# TASK-004: 09.3 Status, requirements & embedded banner

**Phase:** 09
**Status:** todo
**Requirement(s):** FR-903, FR-904, NFR-905
**Depends on:** TASK-003
**Created:** 2026-08-20

**Sub-phase:** [09.3 — Connection lifecycle & Connect webhooks](../../../../docs/phase-09-tenant-payments/09.3-lifecycle-and-webhooks.md)
**Prerelease:** `v0.10.0-alpha.4` · **Flag:** `payments.stripe_connect`

## Context

"Pending" with no detail generates support tickets. The output of this task is a page that answers
one question: *can I take money yet, and if not, what exactly do I do next.*

The backend computes `can_accept_payments`. The frontend renders it and never recomputes readiness
from capability strings — one definition, one place.

## What to do

- [ ] **Status section** — capability states, the plain-language requirement list with deadlines, and
      an explicit verdict banner: *you can accept payments* / *you cannot accept payments yet,
      because …*. Requirement text comes from the `summary_key` the API returns; an unmapped code
      falls back to the raw code plus a Stripe help link rather than breaking the page.
- [ ] **`notification_banner` embedded component** — always rendered on the payments settings page.
      It is how evolving Stripe requirements reach the tenant without us building a notification
      pipeline.
- [ ] **`account_management` embedded component** plus a link to the tenant's real Stripe Dashboard.
      They have `dashboard: "full"`; do not reimplement Stripe.
- [ ] **Live-ish updates** — poll `GET /api/v1/tenant/payments/connections/{id}` while onboarding is in
      progress, with backoff, stopping when active or when the tab is hidden. Webhook lag means "just
      finished at Stripe" and "active here" are seconds apart, so the UI says *checking with Stripe*
      rather than showing a stale *pending*.
- [ ] **Restricted state** — a distinct, prominent treatment with the reason and the remediation path,
      not a variant of pending. A restricted account mid-trading is the tenant's emergency.

## Acceptance criteria

- [ ] Component tests render the restricted, pending-verification and active states correctly from
      fixture payloads, including deadlines where Stripe gives one.
- [ ] An unmapped requirement code degrades to the raw code plus a help link, with no crash and no
      blank section.
- [ ] Every outstanding requirement renders in both `en` and `ja`.
- [ ] The `notification_banner` renders on the payments settings page in every connection state.
- [ ] No status is conveyed by colour alone — each state carries an icon and text; the axe check
      passes on the page.
- [ ] Polling backs off, stops when the connection is active, and stops when the tab is hidden —
      asserted by a test, not by inspection.
- [ ] `can_accept_payments` is read from the API; a grep test confirms the frontend never derives
      readiness from a capability string.

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

Storefront checkout (TASK-005), payments list and refunds (TASK-006), the `payouts` component and the
tax section (TASK-007), disconnect (TASK-008).

## Files likely touched

- `apps/admin/src/routes/PaymentsSettings.svelte` and its status sub-components
- `packages/payments-connect/**` (banner + account management mounts)
- `packages/i18n` catalogs (`en`, `ja`) — requirement `summary_key` messages
- component test fixtures for connection payloads

## Notes / gotchas

- The requirement `summary_key` map is data on the backend. When Stripe adds a code we do not know,
  the page must degrade rather than break — test that path explicitly, it is the one that will
  actually happen in production.
- Do not poll a hidden tab. It burns the tenant's battery and our rate limit for nothing.

---
*On completion: satisfy every acceptance criterion, run the verification commands,
then record status with the sdlc-planner script (never by hand-editing this line
and the backlog separately):*
`sdlc.py status TASK-004 done --note "<PR or commit>"`
