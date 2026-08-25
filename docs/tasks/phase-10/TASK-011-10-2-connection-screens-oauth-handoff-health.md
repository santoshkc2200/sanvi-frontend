# TASK-011: 10.2 Connection screens, OAuth handoff & health

**Phase:** 10
**Status:** todo
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
- [ ] **Connection screen** — composes TASK-010's `AdPlatformCard`. The pre-connect state explains what
      will be requested and why, in plain language, **per scope**. No dark patterns, no "connect to find
      out".
- [ ] **OAuth handoff** — POST to `start`, redirect, return to a callback route that shows progress and
      resolves to the account picker.
- [ ] **Account picker** — searchable, showing account name, external id, currency, and **timezone**,
      with the timezone's consequence stated at selection time.
- [ ] **Health states** — healthy, token expiring, re-consent required (naming the missing scope),
      disconnected, last sync failed with its error. Each with the one action that fixes it, and none
      conveyed by colour alone.
- [ ] **Disconnect with consequences** — stated plainly: metrics stop updating, conversion uploads
      stop, **campaigns keep running on the platform and keep spending**. That last one surprises
      people; it gets its own line, not a clause. Typed confirmation, then step-up.
- [ ] **Reconnect** — an explicit path that preserves campaign history, visually distinguished from
      connecting a different account.

## Acceptance criteria

- [ ] Connect completes end to end against a mocked OAuth flow for both platforms and lands on a
      healthy connection with a last-sync time.
- [ ] No token, client secret, or authorization-URL construction exists in frontend source or any
      bundle; `node scripts/check-no-secret-keys-in-bundle.mjs` passes with the phase patterns.
- [ ] A manager/business account with more than one eligible ad account renders a working picker
      showing currency and timezone for each.
- [ ] Each health state renders its own message and its single fixing action; `scopes_missing` names
      the missing scope and what stopped working.
- [ ] Disconnect requires typed confirmation, states the "campaigns keep spending" consequence above
      the fold, and triggers step-up before submitting.
- [ ] Reconnecting the same account is presented as distinct from connecting a different one.
- [ ] axe passes on the connection screen, picker, and disconnect dialog; the full flow is keyboard
      operable.
- [ ] `pnpm check:i18n` passes with `en` and `ja` copy for every scope explanation and health state.

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

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
