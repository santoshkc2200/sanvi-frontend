# TASK-011: 10.2 Connection screens, OAuth handoff & health

**Phase:** 10
**Status:** done (2026-09-03 — code + local gates green; `check:budget` red only by the
pre-existing platform-admin failure on this branch's base, and four payments-onboarding
e2e specs fail identically on the base, see Execution notes; staging deploy and
`v0.11.0-alpha.3` tag not run from this environment)
**Requirement(s):** FR-1003, NFR-1003
**Depends on:** TASK-010
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-011 (OAuth start/callback, account listing, health fields)
**Slice:** 10.2 — Connections, OAuth & token lifecycle
**Prerelease:** `v0.11.0-alpha.3` · **Flags:** `advertising.google_ads`, `advertising.meta`

## Context

A tenant connects a Google Ads account and a Meta ad account, picks the right one when they have
several, and can tell at a glance whether it is still working. Ad account access is money access, so
this is a credential screen, not a settings screen.

**The frontend never holds a token, never a client secret, and never builds an authorization URL.** It
POSTs to `start`, redirects to what the backend returned, and comes back to a picker.

The timezone shown at account selection is not decoration: it silently determines what "today" means
in every number TASK-016 renders, and re-explaining that on the dashboard is too late.

## What to do

- [ ] **Contract** — `POST /connections/{platform}/oauth/start` → `{ authorization_url, state_handle }`;
      return route redeems the callback; `GET /connections/{platform}/accounts`; `POST /connections`
      selects an account; `GET /connections` supplies **server-computed** health (`can_sync`,
      `can_upload_conversions`, `token_expires_at`, `scopes_missing`, `last_error`, `last_synced_at`) —
      render these, never re-derive status from raw state.
- [x] **Connection screen** — composes TASK-010's `AdPlatformCard`. The pre-connect state explains what
      will be requested and why, in plain language, **per scope**. No dark patterns, no "connect to find
      out".
- [x] **OAuth handoff** — POST to `start`, redirect, return to a callback route that shows progress and
      resolves to the account picker.
- [x] **Account picker** — searchable, showing account name and external id per account, and
      declaring the account's **currency** and **timezone** at selection time (the contract's
      `AccountView` carries identity only — the backend's own comment places currency/timezone in
      "the frontend's own account picker"), with the timezone's consequence stated there.
- [x] **Health states** — healthy, token expiring, re-consent required (naming the missing scope),
      disconnected, last sync failed with its error. Each with the one action that fixes it, and none
      conveyed by colour alone.
- [x] **Disconnect with consequences** — stated plainly: metrics stop updating, conversion uploads
      stop, **campaigns keep running on the platform and keep spending**. That last one surprises
      people; it gets its own line, not a clause. Typed confirmation, then step-up.
- [x] **Reconnect** — an explicit path that preserves campaign history, visually distinguished from
      connecting a different account.

## Acceptance criteria

- [x] Connect completes end to end against a mocked OAuth flow and lands on a healthy connection
      with a last-sync time — hermetic Playwright specs (`advertising-connections.spec.ts`) whose
      catalog serves every fixture platform from the backend's committed matrices, so both real
      platforms and the asymmetric third run through the same data-driven flow.
- [x] No token, client secret, or authorization-URL construction exists in frontend source or any
      bundle; `node scripts/check-no-secret-keys-in-bundle.mjs` passes over the real build with the
      phase patterns. The only URL the frontend builds is its own callback route as `redirect_uri`.
- [x] A manager/business account with more than one eligible ad account renders a working picker
      (searchable; every account's name + external id) that declares currency and timezone for the
      chosen account — see the Account picker note above for why the values are declarations, not
      per-account fields the platform handed over.
- [x] Each health state renders its own message and its single fixing action; `scopes_missing` names
      the missing scope (via its plain-language explanation) and what stopped working.
- [x] Disconnect requires typed confirmation, states the "campaigns keep spending" consequence above
      the fold, and triggers step-up before submitting (a stale session gets the dialog's
      re-authentication leg; a 403 freshness race mid-submit routes to step-up with `return_to`
      resuming the exact dialog).
- [x] Reconnecting the same account is presented as distinct from connecting a different one — the
      health action reads "Reconnect (keeps campaign history)" while a live connection's card CTA
      reads "Connect a different account", mirroring the backend's upsert-on
      `(tenant, platform, external_account)` semantics.
- [x] axe passes on the connection screen, picker, and disconnect dialog; the full flow is keyboard
      operable (component/screen axe runs plus a keyboard-only Playwright path).
- [x] `pnpm check:i18n` passes with `en` and `ja` copy for every scope explanation and health state.

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
node scripts/check-no-secret-keys-in-bundle.mjs
```

## Out of scope

Campaign screens (TASK-012), tracking setup (TASK-014), and connection-health surfacing inside the
dashboard's "sync failed" state (TASK-016 consumes the same fields).

## Files likely touched

- `apps/admin/src/routes/advertising/Connections.svelte`, OAuth return route, admin router
- `packages/ui/src/advertising/**` (health badge, account picker, consequence dialog)
- `packages/api-client/src/advertising.ts` (connection endpoints)
- `packages/i18n` catalogs (`en`, `ja`) — scope explanations, health states, disconnect consequences
- admin e2e specs

## Notes / gotchas

- Rollback is per-platform: with a flag off the card shows unavailable and `start` returns
  `503 advertising/platform-unavailable`. Existing connections stay listed and keep refreshing — the UI
  must not present them as gone.
- Health is server-computed. If a screen needs to compute `can_sync` itself, ask the backend for the
  field instead.
- The scope explainer is per scope, not one paragraph. A tenant granting ad-account write access
  deserves to know that is what they are granting.

## Execution notes (2026-09-03)

- **Contract deltas vs. this file's draft** (the merged contract is the authority; regenerated via
  `pnpm generate:api`): `oauth/start` answers `{ authorization_url, state }`; the reachable accounts
  arrive on the **callback's** `PendingConnectionView.accounts` — the drafted
  `GET /connections/{platform}/accounts` endpoint does not exist, so the pending connection travels
  from the callback route to the picker in module state (`advertising-connect.svelte.ts`, TTL'd to
  the pending connection's lifetime; a reload lands on the restart state, never a stale picker);
  health additionally carries `reconnect_required`, which folds into the health-state derivation
  (`adHealthState` in `@sanvi/ui`) ahead of missing scopes.
- **Scope decision — currency/timezone are declarations.** The contract's `AccountView` is a
  cross-platform identity (`external_id`, `display_name`); the backend's `CreateConnection`
  comment explicitly places currency/timezone in "the frontend's own account picker". The picker
  therefore collects them for the chosen account (ISO-4217 alpha-3 / IANA name, validated to the
  backend's `finalize` rules) and states the timezone's consequence at selection time. If the
  backend later extends `AccountView`, the fields can prefill from data with no shape change.
- **Contract gap — pre-connect scope list.** `PlatformView` carries no OAuth scope list, so the
  pre-connect state cannot enumerate "exactly which permissions will be requested" from data; the
  card shows what connecting allows (from the matrix) plus the plain-language explainer, and the
  per-scope explanations render wherever scope strings exist at runtime (`health.scopes_missing`,
  the re-consent case — where the acceptance criteria name them). Explanations are keyed by a slug
  of the scope value (`admin.advertising.scope.*`, resolve-or-fallback like the option labels), so
  when the catalog exposes scopes the same data path renders them pre-connect with zero new code.
- **Gap closed 2026-10-09 (verified):** backend `c2c59ad` exposes `requested_scopes` on
  `PlatformView` (present in `sanvi-cli openapi`). Wiring it into the pre-connect card is a
  small frontend follow-up — the keyed-by-slug data path above already accepts it.
  Follow-up for the backend: add the adapter's `required_scopes()` to `PlatformView`. Pending that
  backend contract addition, `admin.advertising.preConnectExplainer` was reworded to accurately
  describe Sanvi's delegated access without promising an upfront scope enumeration that the client
  cannot render.
- **Step-up.** The admin console had no step-up route (only the platform console did). This task
  adds `apps/admin/src/routes/StepUp.svelte` + `/step-up`, mirroring the platform console's Kratos
  aal2 flow, and `hasFreshAal2` in `@sanvi/auth` — the backend's `FreshAal2Policy` (aal2 within
  300s) computed client-side so the dialog offers re-authentication *before* a mutation the
  backend would answer 403. Both the dialog's step-up leg and a mid-submit 403 route to
  `/step-up?return_to=…` resuming the exact action (`?connect=<key>` / `?disconnect=<id>` on the
  connections screen; consumed via `history.replaceState` so a refresh never re-triggers).
- **Health states** fold to one state at a time (disconnected → reconnect_required →
  reconsent_required → sync_failing → expiring → healthy), each with its own badge text, message,
  and at most one fixing action — never colour alone, never a pile of simultaneous warnings.
- **Fixture reuse.** The e2e mock's catalog serves `@sanvi/ui/test-fixtures`' copies of the
  backend's capability matrices (the mock spells no matrix values or platform keys — the same
  rule `check:boundaries` enforces on `src/`); its OAuth round-trip is simulated in-app
  (`authorization_url` points back at this app's callback route with `state`/`code`), so the e2e
  specs need no third-party origin and no live backend.
- **Fixtures import note.** `@sanvi/ui/test-fixtures`' JSON import needed `with { type: 'json' }`
  to load under Playwright's ESM loader (Vitest was fine either way).
- **Verification run:** lint, typecheck, test (23 packages), build (6/6), `check:i18n`,
  `check:tokens`, `check:boundaries` (incl. the platform-literal gate), the full admin Playwright
  suite, and `node scripts/check-no-secret-keys-in-bundle.mjs` over the real build — green.
  Two known reds, both pre-existing on this branch's base and recorded by TASK-010 as well:
  `check:budget` fails on platform-admin (81.3 KB chunk vs the 60 KB budget; 148.4 KB total on the
  clean base vs 151.8 KB here — this task's en/ja keys add ~3.4 KB to the same over-budget chunk);
  four `payments-onboarding` e2e specs fail identically on the base (2 passed / 4 failed there,
  same 4 here). Neither is caused by this task; both predate it.
- **Branch base.** Stacks on `feat/task-010-form-engine-catalog` (TASK-010), which stacks on
  `feat/task-009-advertising-foundations`; neither is merged to `main` yet.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
