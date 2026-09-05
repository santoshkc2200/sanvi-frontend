# TASK-032: Shard the i18n catalogs by surface

**Phase:** 10
**Status:** todo
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

- [ ] No app's build output contains a key from a surface it does not render;
      asserted by a check, not by inspection.
- [ ] The `MessageKey` union and the Japanese parity assertion still fail at compile
      time on a missing key.
- [ ] `pnpm i18n:check` passes and understands the shard layout.
- [ ] `apps/storefront`'s `--initial-kb` is lowered to its measured figure, and
      `pnpm check:budget` passes at that number.
- [ ] `pnpm check:quiet` green across the workspace.
