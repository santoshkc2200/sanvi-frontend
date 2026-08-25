# TASK-010: 10.1 Capability-driven form engine & platform catalog

**Phase:** 10
**Status:** todo
**Requirement(s):** FR-1002, NFR-1001
**Depends on:** TASK-009
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-010 (capability matrices + fake adapter fixtures)
**Slice:** 10.1 — Domain model, capability matrix & fake adapter
**Prerelease:** `v0.11.0-alpha.2` · **Flag:** `advertising.enabled`

## Context

The single largest frontend asset of the phase. Everything from TASK-012 onward composes it, and if it
is right, TASK-013 adds Meta with **no new frontend code at all** — only a new matrix arriving as data.

**The rule: the matrix is the only source.** Fields the platform cannot express are absent, not
disabled-and-broken. No objective list, no character limit, no placement name is ever written in
frontend source. A platform adding an objective must be a backend data update, not a frontend release.

The backend's fake adapter ships three deliberately asymmetric matrices; they are committed here as
fixtures so form-engine tests need no running backend, and so TASK-013's "third network" proof has
something to render.

## What to do

- [ ] **Contract** — consume the real `GET /api/v1/tenant/ads/platforms` response: per platform,
      display metadata, entitlement key, connection state, and a versioned `matrix_version` capability
      matrix. Cache by `matrix_version`.
- [ ] **Form engine** (`packages/ui`) — schema → fields → validation. Given a matrix and a draft it
      renders the right inputs, hides what the platform cannot express, enforces limits client-side
      (including **per-locale** text limits), and maps backend violations back onto fields **by field
      path**.
- [ ] **Violation mapping** — a server violation with a field path lands on that field's input with its
      message; an unmapped violation surfaces at form level rather than being swallowed. Both paths are
      tested.
- [ ] **Platform catalog UI** — `AdPlatformCard` per platform: entitlement state, connection state,
      what connecting will allow, and the scopes that will be requested. TASK-011's connection screen
      **composes** this card rather than replacing it.
- [ ] **Matrix fixtures** — the fake adapter's three matrices committed under the shared test fixtures,
      including the third one no real platform implements.
- [ ] **Grep gate** — a lint gate failing on platform literals (`'meta'`, `'google_ads'`, objective and
      limit constants) inside form paths, wired into `pnpm check:boundaries` or the `lint-gates`
      package. This is the gate TASK-013's abstraction proof depends on.

## Acceptance criteria

- [ ] The form engine renders and validates two structurally different fake platforms from matrix data
      alone, with no per-platform code.
- [ ] A field absent from the fake's "Meta-like" matrix does not render for it.
- [ ] A backend violation carrying a field path lands on that field's input; an unmapped one shows at
      form level.
- [ ] A Japanese string that passes the English limit is rejected against the Japanese limit, with the
      counter reflecting the right limit per field per locale.
- [ ] The catalog lists non-entitled platforms with their upgrade state rather than omitting them.
- [ ] The grep gate fails on a deliberately added platform literal in a form path (prove it in the PR).
- [ ] No objective, limit, or placement literal exists anywhere in frontend source.
- [ ] axe passes on the catalog and on a rendered form for each fixture matrix.

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

Connection screens and OAuth (TASK-011), the campaign builder stepper that composes this engine
(TASK-012), creative fields and previews (TASK-013).

## Files likely touched

- `packages/ui/src/forms/**` (engine, field registry, violation mapping)
- `packages/ui/src/advertising/AdPlatformCard.svelte`
- `apps/admin/src/routes/AdvertisingSettings.svelte` (catalog rendering)
- shared test fixtures for the three fake matrices
- `packages/lint-gates/src/**` (platform-literal gate)

## Notes / gotchas

- Resist "just this one" special case for a platform quirk. If the engine needs to know a platform's
  name, the matrix is missing a field — ask the backend for it.
- Character counters must read their limit from the matrix per locale, not from a constant with a
  Japanese override.
- Rollback is flag-off; the catalog returns empty and the shell page falls back to TASK-009's empty
  state.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
