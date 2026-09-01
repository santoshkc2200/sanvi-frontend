# TASK-003: 09.2 Connect.js loader & embedded onboarding

**Phase:** 09
**Status:** done
**Requirement(s):** FR-902, NFR-901, NFR-907
**Depends on:** TASK-002
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-003 (Accounts v2 creation + Account Session endpoint)
**Slice:** 09.2 — Stripe Connect onboarding
**Prerelease:** `v0.10.0-alpha.3` · **Flag:** `payments.stripe_connect`

## Context

A tenant admin clicks *Connect Stripe* and completes Stripe's embedded onboarding without leaving the
admin console. We render Stripe's component; we never build our own onboarding form, because a custom
form would force us to collect sensitive PII and build our own remediation flows.

Status shown here is still thin — it becomes truthful in TASK-004 when webhook-driven state arrives.

## What to do

- [x] **Connect.js loader** — a small wrapper package (`packages/payments-connect`) exposing an
      initializer that fetches the account session from
      `POST /api/v1/tenant/payments/connections/{id}/session` and returns the Connect instance.
      Pinned Connect.js version; loaded **only** on pages that need it, never in the storefront
      bundle. `billing-elements` stays the Stripe **Elements** package for platform billing — do not
      conflate the two.
- [x] **Pre-connect explainer** — the TASK-002 copy, plus what Stripe will ask for and roughly how
      long it takes. A tenant who understands the flow finishes it.
- [x] **Embedded `account_onboarding`** in `PaymentsSettings.svelte`, mounted after the connection is
      created, with appearance options mapped from our design tokens where the component API allows.
      The settings surface uses the **admin** theme, not the tenant storefront theme.
- [x] **Resumability** — closing the tab and returning re-fetches a fresh session and re-mounts at the
      same place; the page never asks a tenant to start over. A session-fetch failure shows a retry,
      not a blank iframe.
- [x] **Loading & failure states** — component load failure (CSP, network, Stripe outage) gets a
      specific message with a retry and a support path, never a silent empty box.

## Acceptance criteria

- [x] E2E: connect → the embedded onboarding component renders → close the tab → return → the flow
      resumes where it was, with no "start over".
- [x] Onboarding renders under the **production** CSP from TASK-001, not a relaxed dev policy.
- [x] The account session client secret is fetched per render and never written to `localStorage`,
      `sessionStorage`, a cookie, or the console — asserted by a test.
- [x] A forced session-fetch failure renders a retry affordance rather than an empty iframe.
- [x] Connect.js appears in the admin bundle only; a bundle assertion proves it is absent from the
      storefront.
- [x] `pnpm check:i18n` passes for every new string, in `en` and `ja`.
- [x] `pnpm check:budget` still passes for both apps.

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
pnpm test:e2e --filter admin
node scripts/bundle-size-report.mjs
```

## Out of scope

Status, requirements and the verdict banner (TASK-004); `notification_banner` and
`account_management` components (TASK-004); the `payouts` component (TASK-007).

## Files likely touched

- `packages/payments-connect/**` (new package: loader, session fetch, appearance mapping)
- `apps/admin/src/routes/PaymentsSettings.svelte`
- `packages/i18n` catalogs (`en`, `ja`)
- `pnpm-workspace.yaml`, `turbo.json` if the new package needs registering

## Notes / gotchas

- Pin the Connect.js version and treat upgrades as dependency changes with integration tests — a
  floating version is a silent breaking change waiting for a Stripe release.
- Appearance options are mapped from tokens **where the component API allows**; do not fight the
  component's styling limits with CSS overrides that will break on their next release.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
