# TASK-002: 09.1 Provider catalog & provider-card adapter shape

**Phase:** 09
**Status:** todo
**Requirement(s):** FR-901, NFR-904, NFR-906
**Depends on:** TASK-001
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-002 (provider catalog endpoint + fake provider adapter)
**Slice:** 09.1 — Provider-agnostic domain & catalog
**Prerelease:** `v0.10.0-alpha.2` · **Flag:** `payments.enabled`

## Context

The Providers section of the payments settings page, built against the backend's **fake provider**
before anyone needs Stripe sandbox credentials. The shape decided here is what makes adding PayPal or
a Japanese provider later a new adapter and a new catalog entry rather than a redesign of the
settings page.

The pre-connect explainer copy is written once here and reused in TASK-003.

## What to do

- [ ] **Provider catalog UI** — the Providers section of `PaymentsSettings.svelte`: one
      `PaymentProviderCard` per catalog entry from `GET /api/v1/tenant/payments/providers`, with a
      connect CTA, a status slot, and an unavailable state for providers not supported in the tenant's
      country.
- [ ] **`PaymentProviderCard` + adapter shape** — a per-provider client adapter exposing `connect()`,
      `status()` and `manage()`, registered by `kind`. No component outside the registry branches on
      the provider kind. Build it against the fake provider first.
- [ ] **Entitlement gating** — `UpgradePrompt` when the entitlement is absent. The card list stays
      visible so tenants can see what they would get; only the CTA is replaced.
- [ ] **Copy** — the "what happens when you connect" explainer: Stripe collects the business details,
      payouts go to the tenant's own bank account, Sanvi never holds the money. All strings through
      the phase-06 catalogs in `en` and `ja`; the phase-00 lint gate already forbids hardcoded
      user-facing strings.

## Acceptance criteria

- [ ] The card list renders purely from the API response, with no `kind`-specific branching anywhere
      outside the adapter registry — asserted by a test that adds a synthetic provider to a mocked
      catalog response and gets a rendered card with no code change.
- [ ] A provider marked unavailable for the tenant's country renders the unavailable state, not a
      dead connect button.
- [ ] Without the entitlement, the cards render and the CTA is replaced by `UpgradePrompt`.
- [ ] Every string on the page resolves in both `en` and `ja`; `pnpm check:i18n` passes.
- [ ] `pnpm check:tokens` passes — no hardcoded colours, fonts, spacing or radii on the new
      components.
- [ ] Component tests cover the available, unavailable and un-entitled states.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:i18n
pnpm check:tokens
pnpm check:boundaries
```

## Out of scope

Connect.js, account sessions and any embedded Stripe component (TASK-003); the status and requirements
presentation (TASK-004); disconnect (TASK-008).

## Files likely touched

- `apps/admin/src/routes/PaymentsSettings.svelte`
- `packages/ui/src/components/PaymentProviderCard.svelte` (or the admin-local equivalent)
- the provider adapter registry (new module) + its tests
- `packages/i18n` catalogs (`en`, `ja`)

## Notes / gotchas

- The explainer copy is load-bearing: tenants who believe Sanvi holds their money file support
  tickets. Write it once here and import it in TASK-003 rather than duplicating the strings.
- The fake provider is `available: true` only in non-production builds; the UI must not assume it
  exists.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
