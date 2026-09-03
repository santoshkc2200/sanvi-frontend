# TASK-010: 10.1 Capability-driven form engine & platform catalog

**Phase:** 10
**Status:** done (2026-09-03 — code + local gates green; `check:budget` red only by a
pre-existing failure on this branch's base, see Execution notes; staging deploy and
`v0.11.0-alpha.2` tag not run from this environment)
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

- [x] **Contract** — consume the real `GET /api/v1/tenant/ads/platforms` response: per platform,
      display metadata, entitlement key, connection state, and a versioned `matrix_version` capability
      matrix. Cache by `matrix_version`.
- [x] **Form engine** (`packages/ui`) — schema → fields → validation. Given a matrix and a draft it
      renders the right inputs, hides what the platform cannot express, enforces limits client-side
      (including **per-locale** text limits), and maps backend violations back onto fields **by field
      path**.
- [x] **Violation mapping** — a server violation with a field path lands on that field's input with its
      message; an unmapped violation surfaces at form level rather than being swallowed. Both paths are
      tested.
- [x] **Platform catalog UI** — `AdPlatformCard` per platform: entitlement state, connection state,
      what connecting will allow, and the scopes that will be requested. TASK-011's connection screen
      **composes** this card rather than replacing it.
- [x] **Matrix fixtures** — the fake adapter's three matrices committed under the shared test fixtures,
      including the third one no real platform implements.
- [x] **Grep gate** — a lint gate failing on platform literals (`'meta'`, `'google_ads'`, objective and
      limit constants) inside form paths, wired into `pnpm check:boundaries` or the `lint-gates`
      package. This is the gate TASK-013's abstraction proof depends on.

## Acceptance criteria

- [x] The form engine renders and validates two structurally different fake platforms from matrix data
      alone, with no per-platform code.
- [x] A field absent from the fake's "Meta-like" matrix does not render for it.
- [x] A backend violation carrying a field path lands on that field's input; an unmapped one shows at
      form level.
- [x] A Japanese string that passes the English limit is rejected against the Japanese limit, with the
      counter reflecting the right limit per field per locale.
- [x] The catalog lists non-entitled platforms with their upgrade state rather than omitting them.
- [x] The grep gate fails on a deliberately added platform literal in a form path (prove it in the PR).
- [x] No objective, limit, or placement literal exists anywhere in frontend source.
- [x] axe passes on the catalog and on a rendered form for each fixture matrix.

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

## Execution notes (2026-09-03)

- **Form engine** lives in `packages/ui/src/forms/`: `types.ts` (structural mirror of the contract's
  `CapabilityMatrix`, redeclared because `ui` never imports `api-client`), `schema.ts` (matrix → field
  schema; memoized per `matrix_version` + content digest so refetches of an unchanged matrix reuse the
  object and `$derived`s don't churn), `validate.ts` (client rules mirroring the backend's
  `matrix.rs`/`validation.rs`, including the `default` limits-entry fallback), `humanize.ts`
  (presentation fallback for unseen values), `CapabilityForm.svelte` (renderer). Field paths
  (`objective`, `budget.kind`, `budget.amount.amount_minor`, `texts[i].<field>`) are the backend
  validator's own `field_path` vocabulary, so server violations attach to inputs without translation.
- **Scope decision — schedule/creative sections deferred.** The engine covers name, objective, budget
  (kind + minimum from the matrix), targeting, and localized texts (the per-locale-limit machinery the
  acceptance criteria need). Schedule dates and asset specs land with the TASK-012 builder and TASK-013
  creatives, which compose this engine; none of the fixture matrices differ structurally on schedule
  (`daily` everywhere).
- **Contract caching reading.** The catalog fetch stays per-mount in the admin page (connection state
  is freshness-sensitive), while everything *derived from a matrix* caches by `matrix_version`
  (`campaignFormSchema`), with a content digest so two platforms sharing a version string never share
  an entry.
- **Catalog page gate model changed from TASK-009.** The page no longer pre-checks
  `hasFeature('advertising.google_ads' | 'advertising.meta_ads')` — those literals were exactly what
  the new gate exists to catch. Entitlement state now comes per-platform from the catalog's
  `upgrade_required`/`available`; 403 (no entitlement) and 404 (flag off) fall back to the page-level
  `UpgradePrompt`, as before. Tests updated to match.
- **axe finding fixed in passing:** the catalog section was briefly a named `<section>` (a region
  landmark); the per-card `UpgradePrompt`'s `<aside>` inside it trips
  `landmark-complementary-is-top-level`. The page uses a plain wrapper around the heading instead.
- **Grep gate** (`packages/lint-gates/src/check-platform-literals.mjs`) runs inside
  `pnpm check:boundaries`: tier 1 bans `google_ads`/`meta_ads`/`asymmetric_demo` in any shipped source
  (generated/ exempt; comments stripped before scanning so contract documentation stays speakable);
  tier 2 bans matrix values (objectives, budget kinds, placements, text-field/limit names) as quoted
  literals or multiword identifiers inside form paths (`forms/`/`advertising/` trees, filenames
  containing `advertising`). Fixture-backed tests cover both tiers plus the comment-stripping rule.
  **Prove-it demonstration (this session, reverted):** appending
  `export const PROVE_IT = { platform: 'google_ads', objective: 'sales' }` to
  `packages/ui/src/forms/schema.ts` made `pnpm check:boundaries` exit 1 with both tiers reported
  (`"google_ads"` tier 1, `"sales"` tier 2, schema.ts:135); removing it restored the green run.
- **Branch base.** This branch stacks on `feat/task-009-advertising-foundations` (TASK-009), which is
  not yet merged to `main`. `main` gained 15e2a47 (lazy ja catalog + raised budgets) after this branch
  was cut; that change fixes the `check:budget` redness this branch still reports. On this branch's
  base, `check:budget` fails on platform-admin exactly as it fails on the clean TASK-009 tree (verified
  against a temporary worktree of d3b8422: 77.2 KB vs 60 KB budget before this change; 78.0 KB after,
  the delta being the new en/ja catalog keys this task adds). The merge to main's 75 KB budget carries
  the new keys with headroom. Marketing's previously-recorded failure is already fixed by 15e2a47's
  budgets on main and passes here on the storefront/marketing gates that run.
- **Verification run:** lint, typecheck, test (all 23 packages), build, `check:i18n`, `check:tokens`,
  `check:boundaries` (now carrying the platform-literal gate) — green; `check:budget` red only as
  described above. Playwright e2e not run (needs a live backend), per the standing TASK-004/009 note.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
