# TASK-009: 10.0 Generated client, CSP & advertising shell

**Phase:** 10
**Status:** todo
**Requirement(s):** FR-1001, NFR-1003, NFR-1007, NFR-1008
**Depends on:** phase 09
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-009 (`api/advertising.yaml` merged)
**Slice:** 10.0 — Contract, schema & foundations
**Prerelease:** `v0.11.0-alpha.1` · **Flag:** `advertising.enabled` (off)

## Context

The frontend half of the foundations slice. Nothing user-visible ships: this task proves the contract
pipeline end to end against the empty platform list, puts the ad-platform origins into the shared CSP
builder before any OAuth code exists, and lands an entitlement-gated shell page for later slices to
fill in.

Doing the CSP now, in the shared package, is what stops the admin and the storefront from drifting
apart later. The storefront gets **nothing** here: first-party tracking in TASK-014 is same-origin by
design, and its policy must be provably unchanged by this phase.

The formatters land here too, because every screen from TASK-016 onward renders money and ratios, and
a per-screen `toFixed` is how JPY grows decimals and a zero-spend ROAS renders as `∞`.

## What to do

- [ ] **Generated client** — regenerate `packages/api-client` from the backend's new
      `advertising.yaml` (`pnpm generate:api`). The empty platform list proves the pipeline end to end.
- [ ] **CSP** — add the ad-platform origins needed for OAuth handoff and creative previews to
      `packages/csp` as a named `ads()` preset, never ad-hoc per app, so admin and storefront cannot
      drift. A unit test asserts the preset produces no `unsafe-inline` widening; a storefront snapshot
      asserts its policy is **unchanged**.
- [ ] **Admin shell page** — `apps/admin/src/routes/AdvertisingSettings.svelte`, registered in the SPA
      router and entitlement-gated: `UpgradePrompt` without the entitlement, an empty state with it. No
      platform code yet.
- [ ] **Metric formatting** — extend `packages/ui` formatters with ad-account-currency display, a
      zero-decimal guard, and a ratio formatter for ROAS/CPA that renders `—` rather than `∞` or `NaN`
      at zero spend. Unit-tested against JPY and USD, reused by TASK-016 rather than reinvented per
      screen.
- [ ] **Bundle credential scan** — extend `scripts/check-no-secret-keys-in-bundle.mjs` with the
      ad-platform patterns (OAuth client secret, Google Ads developer token) so a leak fails CI from
      the start of the phase, not at the end.

## Acceptance criteria

- [ ] `pnpm generate:api` produces an advertising client and `pnpm typecheck` passes against it.
- [ ] The admin CSP snapshot includes the `ads()` preset origins and contains no `unsafe-inline`; the
      storefront CSP snapshot is byte-identical to phase 09's.
- [ ] The advertising settings route renders `UpgradePrompt` without the entitlement and an empty state
      with it; no ad-platform script loads on either path.
- [ ] The currency formatter renders JPY with no decimals and USD with two; the ratio formatter returns
      `—` for zero spend, zero revenue, and both zero — no division by zero anywhere.
- [ ] `node scripts/check-no-secret-keys-in-bundle.mjs` runs over a real build, covers the ad-platform
      patterns, and exits 0.
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

The form engine and platform catalog UI (TASK-010), connection screens and OAuth handoff (TASK-011),
chart primitives (TASK-016), and anything storefront-side (TASK-014).

## Files likely touched

- `packages/api-client/src/advertising.ts`, `packages/api-client/src/generated/types.ts`
- `packages/csp/src/index.ts` + tests (the `ads()` preset)
- `apps/admin/src/routes/AdvertisingSettings.svelte`, the admin router
- `packages/ui/src/format/**` (currency, zero-decimal guard, ratio formatter)
- `scripts/check-no-secret-keys-in-bundle.mjs`, CI workflow

## Notes / gotchas

- The storefront gets no new CSP origins in this phase. If a later task needs one, that is a design
  error in the tracking beacon, not a policy update.
- Rollback is flag-off; nothing here has an external side effect.
- Put the formatters in `packages/ui`, not in the dashboard route — TASK-012's campaign list needs them
  before the dashboard exists.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
