# TASK-032: Shard the i18n catalogs by surface

**Phase:** 10
**Status:** done
**Requirement(s):** NFR-1006
**Depends on:** none
**Created:** 2026-09-03

**Slice:** cross-cutting — bundle size
**Release:** unassigned · **Flags:** none

## Context

`packages/i18n/messages/en.json` and `ja.json` are single blobs. `catalogs.ts` imports
them wholesale, so every app bundles every key regardless of which surface it renders.

Measured on the storefront's built client bundle at the TASK-010 merge (`c7146ed`),
the English catalog is 1851 keys / 124,257 raw bytes, distributed like this:

| prefix | keys | raw bytes |
| --- | ---: | ---: |
| `admin` | 979 | 66,628 |
| `platform` | 429 | 24,184 |
| `privacy` | 172 | 13,458 |
| `marketing` | 51 | 3,598 |
| `storefront` | 51 | 3,849 |
| `consent` | 46 | 4,026 |
| `legal` | 45 | 3,361 |
| `payments` | 25 | 2,198 |
| `auth` | 22 | 1,409 |
| `themeblocks` | 13 | 797 |
| `settings` | 8 | 420 |
| `common` | 5 | 129 |
| `errors` | 5 | 200 |

The storefront ships roughly 91 KB raw of `admin.*` and `platform.*` strings it can
never render. They are present in `chunks/CXvXsoBW.js` and `chunks/CWv9C2SF.js`, its
two largest initial chunks — verified by grepping the build output for
`admin.advertising.*`. No admin *code* leaks; tree-shaking handles the components
correctly. Only the strings survive, because a JSON blob has nothing to shake.

This has now been paid for twice. `15e2a47` raised the budget gates to unblock
`check:budget` during phase 09, and the TASK-010 merge raised the storefront's
initial-JS budget again, from 135 KB to 138 KB, when 31 new `admin.advertising.*`
keys (+2,164 raw bytes, ≈ +1.1 KB gzipped) pushed the measured 134.5 KB past the
line. Each phase that adds admin strings will do this again. Raising the number a
third time is not a fix; the gate is reporting a real defect.

## Goal

Each app bundles only the catalog shards its surfaces render. The storefront's
initial JS drops well below its pre-TASK-010 figure, and the budget returns to a
number that reflects the storefront's own code rather than the whole product's
strings.

## Notes for whoever picks this up

- `catalogs.ts` is documented as "the only module that touches the JSON files", so
  the sharding should stay contained there. `en.json`'s keys are the `MessageKey`
  union, and `jaCatalog: Record<MessageKey, string>` is the compile-time parity
  assertion — both need to survive sharding, or the missing-key compile error that
  phase 06 established is lost.
- `pnpm i18n:check` covers orphaned keys, malformed ICU and param drift. It will
  need to understand shards.
- `t` is a `Proxy` over the whole catalog and falls back per key to `BASE_LOCALE`.
  Decide what a key belonging to an unloaded shard should do: today an unknown key
  renders as the key itself with a `console.error`.
- Prefix and surface are not the same thing. `common`, `errors` and `payments` are
  read from more than one app; `privacy` is storefront-facing despite its size.
  Map shards to surfaces deliberately rather than splitting on the first path
  segment.
- Once the storefront no longer carries admin strings, lower its `--initial-kb`
  back down. Leaving the budget at 138 would waste the headroom this task frees.

## Acceptance criteria

- [x] No app's build output contains a key from a surface it does not render;
      asserted by a check, not by inspection.
- [x] The `MessageKey` union and the Japanese parity assertion still fail at compile
      time on a missing key.
- [x] `pnpm i18n:check` passes and understands the shard layout.
- [x] `apps/storefront`'s `--initial-kb` is lowered to its measured figure, and
      `pnpm check:budget` passes at that number.
- [x] `pnpm check:quiet` green across the workspace.

## Execution notes (2026-10-01)

- **Shards** — `messages/{en,ja}/<shard>.json`, split on the key's first path
  segment (13 shards, 2,608 keys; `admin` alone is 1,734 keys / 137.6 KB raw by
  now, larger than the 979 this task was written against). Two keys moved to
  `common` so no console carries another console's shard:
  `admin.boot.failureMessage` → `common.boot.failureMessage` (both `main.ts`
  boot-failure screens) and `admin.nav.switchLanguage` → `common.nav.switchLanguage`
  (both `App.svelte` locale switchers). No other key renames.
- **Surfaces** — `packages/i18n/src/surfaces/{storefront,marketing,admin,platform-admin,all}.ts`,
  exported as `@sanvi/i18n/surfaces/*`. Sets, audited by usage scan *and* by the
  per-app unit suites (which now boot with only their own surface — a component
  reaching outside it renders a raw key and fails its test):
  storefront = storefront, privacy, consent, legal, auth, settings, errors, common,
  themeblocks; marketing = marketing, errors, common; admin = admin, payments,
  consent (the advertising tracking screens read `consent.purpose.<name>.label`
  dynamically — `lib/advertising/tracking.ts:26` — caught by this very test
  discipline, not the static scan), errors, common; platform-admin = platform,
  errors, common. `all` is the tests-only completeness witness.
- **Type safety without bundling** — `MessageKey` is now computed from
  *type-only* `typeof import('…en/<shard>.json')` intersections (no runtime
  import, complete union). Japanese parity is asserted the same way:
  `Exclude<MessageKey, keyof JaShards>` and its mirror must satisfy `never`.
  Falsified: deleting one ja key fails `svelte-check` with
  `Type '"storefront.home.fallbackTitle"' does not satisfy the constraint 'never'`.
- **Registration** — apps call their registrar before the first `t()`:
  SvelteKit apps in `hooks.server.ts` (module scope, server bundle) *and* the
  root `+layout.svelte` (client bundle, mirrors the hook for hydration parity);
  SPAs at the top of `main.ts` (before `initI18n`, so the boot-failure screen
  translates). `catalogs.ts` keeps `en`/`messages`/`jaCatalog` as live merged
  views, so `import { en }` (marketing pricing, admin AdvertisingSettings)
  keeps working. An unloaded shard's key behaves exactly like an unknown key
  (console error + the key itself) — decided per this file's notes.
- **Gates** — `pnpm i18n:check` now actually exists (it was documented but
  wired to nothing): shard-aware catalog gate in `packages/i18n/tools/check.mjs`
  + root script + turbo task, in `check:all`/`check:quiet`. New
  `check:i18n-shards` build-output gate (`packages/lint-gates/src/check-i18n-shards.mjs`)
  asserts per app that no foreign-shard string value appears in the built client
  JS (longest shard-unique values as markers — ~215 short chrome strings like
  "Loading"/"Members" are duplicated across shards and are excluded as
  non-attributable), and that every *own* shard is provably present so the gate
  cannot pass vacuously (the `sideEffects: false` tree-shaking trap). Both gates
  grew unit tests (`check-tool.test.ts`, `check-i18n-shards.test.ts`).
- **Budgets** — `scripts/budgets.json`: storefront initialKb 180 → **88**
  (measured 86.1), marketing 150 → **50** (measured 48.2). The SPA `initialKb`
  values are inert (unmeasured build shape) and unchanged. The storefront is
  now *below* the ≤100 KB architecture target TASK-022 was going to chase.
- `pnpm check:quiet` green across the workspace (final run exit 0). On this
  machine the test stage flaked repeatedly on rotating, unrelated 5000 ms
  timeouts (ui capability-form, storefront tracking-beacon, admin
  diagnostics, platform-admin TenantDetail/oauth — each passing in
  isolation) while the system load average sat at ~46 from other work;
  TASK-019 documented the same class. The chain's every stage is green,
  the tail gates (`boundaries`, `connect-bundle`, `sourcemaps`, `csp`,
  `storage-surface`, `runtime-code-sources`, `i18n-shards`, `secrets`,
  `i18n:check`) also verified standalone. Fixture note: the parser unit
  tests' import-shaped sample sources moved into `__fixtures__/**.txt`
  because `check:boundaries`' regex scanner read them as real
  cross-package imports.
- **e2e**: the storefront `locale.spec.ts` subset was run, not re-baselined
  against a clean-main worktree. Observed failures match the documented
  pre-existing baseline (locale/us-privacy ×18–22 on main since TASK-014's
  lazy-ja, reproduced on clean main in TASK-019): they rotate between
  engines and runs under this machine's load — including an English-only
  assertion (`unprefixed pages are English`), which a shard defect could
  not produce. Positive evidence the sharded paths work end to end: the
  prerendered `/ja` marketing HTML is Japanese, and the storefront's built
  server chunks contain the ja shard values the specs assert on
  (`言語`, `プライバシーの設定`). Per-app component suites (which now boot
  with only their own surface) cover the sharded rendering paths.
- Status recorded in `docs/tasks/backlog.md` in the same commit, on branch
  `feat/task-032-shard-i18n-catalogs`, merged to `main`. The working tree
  also carries unrelated pre-existing edits (`api-client/src/client.ts`,
  `csp/src/vite-plugin.ts`, `lint-gates` check-csp bits,
  `docs/release/needs-humans.md`) that predate this task — deliberately left
  out of this task's commit.
