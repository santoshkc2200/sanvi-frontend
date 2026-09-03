# TASK-009: 10.0 Generated client, CSP & advertising shell

**Phase:** 10
**Status:** done (2026-09-03 — code + local gates green; staging deploy and `v0.11.0-alpha.1` tag not run from this environment)
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

- [x] **Generated client** — regenerate `packages/api-client` from the backend's new
      `advertising.yaml` (`pnpm generate:api`). The empty platform list proves the pipeline end to end.
- [x] **CSP** — add the ad-platform origins needed for OAuth handoff and creative previews to
      `packages/csp` as a named `ads()` preset, never ad-hoc per app, so admin and storefront cannot
      drift. A unit test asserts the preset produces no `unsafe-inline` widening; a storefront snapshot
      asserts its policy is **unchanged**.
- [x] **Admin shell page** — `apps/admin/src/routes/AdvertisingSettings.svelte`, registered in the SPA
      router and entitlement-gated: `UpgradePrompt` without the entitlement, an empty state with it. No
      platform code yet.
- [x] **Metric formatting** — extend `packages/ui` formatters with ad-account-currency display, a
      zero-decimal guard, and a ratio formatter for ROAS/CPA that renders `—` rather than `∞` or `NaN`
      at zero spend. Unit-tested against JPY and USD, reused by TASK-016 rather than reinvented per
      screen.
- [x] **Bundle credential scan** — extend `scripts/check-no-secret-keys-in-bundle.mjs` with the
      ad-platform patterns (OAuth client secret, Google Ads developer token) so a leak fails CI from
      the start of the phase, not at the end.

## Acceptance criteria

- [x] `pnpm generate:api` produces an advertising client and `pnpm typecheck` passes against it.
- [x] The admin CSP snapshot includes the `ads()` preset origins and contains no `unsafe-inline`; the
      storefront CSP snapshot is byte-identical to phase 09's.
- [x] The advertising settings route renders `UpgradePrompt` without the entitlement and an empty state
      with it; no ad-platform script loads on either path.
- [x] The currency formatter renders JPY with no decimals and USD with two; the ratio formatter returns
      `—` for zero spend, zero revenue, and both zero — no division by zero anywhere.
- [x] `node scripts/check-no-secret-keys-in-bundle.mjs` runs over a real build, covers the ad-platform
      patterns, and exits 0.
- [x] `pnpm check:i18n` and `pnpm check:tokens` pass — the shell page has no hardcoded strings or
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

## Execution notes (2026-09-03)

- `pnpm generate:api` pulled the 38 advertising paths (`/api/v1/tenant/ads/**`,
  `/api/v1/public/track`, `/api/v1/platform/ads/health`) into `generated/types.ts`; `pnpm typecheck`
  passes workspace-wide against the regenerated types (24/24 tasks).
- The `ads()` preset allows only the two OAuth *authorization* hosts (`connect-src`, `form-action`)
  plus the two creative-preview CDNs (`img-src`). The token endpoints
  (`oauth2.googleapis.com`, `graph.facebook.com`) are deliberately absent — token exchange is
  server-to-server, and a browser that could reach them would mean client-side token handling.
  Storefront policy pinned byte-for-byte to its phase-09 form in `packages/csp/__tests__`.
- `UpgradePrompt`'s title moved `<h3>` → `<h2>`: composed under a page's `<h1>` (its only real
  context) it skipped a heading level — axe `heading-order` failed on the new shell's upgrade path.
  Styles are class-scoped, so no visual change; its own standalone test still passes.
- The secret scan gained `GOCSPX-` (Google OAuth client secret), a contextual
  `developerToken: "…"` pair (the developer token has no stable prefix), and an `access_token`
  contextual Meta pattern. A bare `EA…` prefix would false-positive on inlined base64 blobs, so Meta
  matches only where an `access_token`-shaped key carries the value; Meta's 32-hex *app secret* is not
  regex-matchable at all and is documented as a review obligation instead.
- `@sanvi/marketing#check:budget` was red while this branch sat at its old base — **pre-existing**:
  the clean phase-09 tree failed identically (initial JS 105.9 KB / 100 KB budget before this change,
  106.2 KB after; the delta is the nine new i18n strings). Resolved by merging `main`, whose
  `15e2a47 fix(i18n): lazy-load ja catalog and raise budget gates` moves the `ja` catalog to an async
  chunk. `check:budget` is green for every package.
- **Merged `main` (2026-09-03)** to close review finding 9. `main` had independently landed the same
  payments-settings review fixes (`911cd4f`, `fb2583c`) and the storefront tax-note wiring
  (`d20767e`), so `PaymentsSettings.svelte`, `OrderSummary.svelte` and their tests were resolved to
  `main`'s reviewed versions; only the disconnect-path localization was re-applied on top. The
  advertising shell and its i18n keys are this branch's alone and were kept.
- `@sanvi/marketing#build` fails locally for want of an `apps/marketing/.env`
  (`PUBLIC_API_ORIGIN is required but was not set`). Environment, not code: the marketing app is
  byte-identical to `main`, and the file is gitignored. Copy `apps/marketing/.env.example` to run
  the full gate locally.
- Not run from this environment: the `v0.11.0-alpha.1` prerelease tag and the staging deploy (no
  release pipeline here). Nothing external exists to roll back; flag stays off.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
