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
      allowed when clean. The mock-based half of this is green (the onboarding spec drives
      connect → embedded onboarding → resume, and the checkout/beacon specs drive the storefront
      journey); the consolidated live-Stripe run remains deferred to a live backend + sandbox.
- [x] **a11y sweep** — payment states, refund dialog, order summary and confirmation: screen-reader
      coherent, keyboard operable, no colour-only status. Unit/integration axe green since the
      partial work; the phase-11 harness sweep adds every payments route × both locales with zero
      serious/critical (`benchmarks/frontend/a11y-task008.json`).
- [x] **Visual sweep** — checkout summary and confirmation across every shipped theme (light, dark)
      and both locales, including the phase-06 CJK typography checks
      (`apps/storefront/e2e/checkout-visual.spec.ts`; chromium+webkit/macOS pixel baselines,
      stable across four consecutive runs; other platforms self-skip — cross-platform baselines
      arrive with TASK-030).
- [x] **Bundle assertions** — no secret or restricted key pattern in any build output
      (`check:secrets` green); Connect.js in admin only, absent from the storefront
      (`check:connect-bundle` green); the storefront performance budget still met
      (`check:budget` green).

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
- [x] The notification banner is present on the payments settings page (system-status probe banner
      unit-tested; the TASK-023 outage matrix renders `/payments/settings` per 500/503/hang off the
      same route list the a11y sweep uses).
- [ ] A customer completes a purchase on the tenant's own domain, in the tenant's theme and language.
- [ ] Checkout is impossible, and clearly explained, while the account cannot accept payments.
- [ ] Refunds work and are correct in JPY and USD.
- [ ] `node scripts/check-no-secret-keys-in-bundle.mjs` passes (it does, on this branch), and no
      card data appears in any bundle or DOM — the DOM half still waits for the live-Stripe suite.
- [x] `pnpm check:budget` passes for the storefront with Stripe added; Connect.js is absent from the
      storefront bundle.
- [x] axe checks pass across every payments surface in both locales
      (`benchmarks/frontend/a11y-task008.json`: storefront checkout routes + admin payments routes,
      0 serious/critical).

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
- **Review findings addressed (2026-09-03, 911cd4f):** A 403 from
  `GET /tenant/payments/providers` renders a permission error, not an upgrade prompt — the route
  registers no `RequiredFeature`, so 403 is a missing `payments.read`; only a 404, the route being
  absent while the `payments.enabled` phase flag is off, renders the upgrade prompt. Payouts and
  tax settings now carry per-section load errors instead of disappearing on a failed request, the
  loader re-runs after Connect onboarding, tax preflight failures show a localized message rather
  than the untranslated `problem.title`, and a configured fixed or minimum platform fee renders
  even when the currency is unknown. `check:budget` and `assert-connect-js-bundle` verified on
  main; `check-no-secret-keys-in-bundle.mjs` passes, but the "no card data in the DOM" half of
  that criterion still needs the e2e suite.

- **Blocked on backend (2026-09-03):** `PaymentsSettings` can only recover an existing payment
  connection id from `localStorage`. `GET /tenant/payments/providers` returns a bare catalog —
  `ProvidersView` has a single `providers` property and `ProviderView` carries no connection id —
  and there is no list endpoint, only `GET /tenant/payments/connections/{id}`. A merchant signing
  in from a second browser or device, or after clearing site data, therefore sees the
  not-connected state — no connection status, disconnect control or onboarding resume — even
  though a connection exists server-side. Payouts and tax settings are unaffected; they load
  independently of the stored id. Unblocking this needs a backend current-connection endpoint;
  there is no frontend-only fix.

- **Blocker cleared 2026-10-09 (verified):** backend `c2c59ad` ships
  `GET /api/v1/tenant/payments/connections/current` (present in `sanvi-cli openapi`).
  Remaining work is frontend-side (consume it in `PaymentsSettings`); this task stays
  `todo` until that lands with its e2e suite, visual baselines, and flag flip.

- **Recovery landed 2026-10-10 (frontend):** `PaymentsSettings` recovers the
  connection id via `GET /payments/connections/current` when localStorage is
  empty, and falls through to it when the stored id 404s; the recovered id is
  persisted per tenant. `getCurrentPaymentConnection` added to `@sanvi/api-client`
  (contract patched to match backend `c2c59ad`; `pnpm generate:api` to converge on
  next backend-spec pull). Unit cover: api-client path test + recovery/404
  component tests; `PaymentsSettings*` 57 green; `check:secrets`,
  `assert-connect-js-bundle`, `check:budget`, `check:boundaries` green.

- **Sweeps landed 2026-10-12 (branch `feat/task-008-release-sweeps`):** the four
  payments-onboarding e2e failures recorded since TASK-015 were **route drift, not a live-backend
  gap** — the spec predates TASK-006/007's split that made `/payments` the transactions list and
  moved onboarding to `/payments/settings`, and predated the `connections/current` recovery,
  payouts and tax-settings calls; retargeted to `/payments/settings` and mocked the newer
  endpoints (6/6 green, chromium+webkit). Storefront checkout visual sweep added
  (`checkout-visual.spec.ts`): summary + confirmation × light/dark × en/ja, DOM invariants
  everywhere (locale yen sign incl. the WebKit ICU divergence the advertising sweep already
  encodes, `lang`, ja CJK overflow/Noto checks), pixel baselines for chromium+webkit/macOS stable
  across four consecutive runs — the SSR stale-content banner is hidden post-settle in pixel tests
  because which side of the 2s `TENANT_CACHE_FRESH_MS` window a request lands on is wall-clock
  timing no test can pin. Axe harness sweep: 0 serious/critical across storefront + admin +
  platform-admin × en/ja (`benchmarks/frontend/a11y-task008.json`); the marketing sweep hangs in
  `serveApp` **pre-existing on main** (environmental: Playwright browser dies after the
  storefront sweep under this Node) — unrelated to payments. Bundle gates green
  (secrets/connect-bundle/budget). Full-suite failure sets verified against a stashed-base run:
  storefront identical (the fonts layout-shift flake bounces between engines), admin payments now
  ZERO failures, remaining admin failures are pre-existing advertising drift (campaigns ×3 +
  journey + visual baselines — TASK-030 scope). Still open: the consolidated live-Stripe e2e
  (genuinely needs live backend + sandbox), and the flag default flip + `v0.10.0` tag (backend
  release actions; frontend holds no flag defaults).

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*

