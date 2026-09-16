# sanvi-frontend

pnpm + Turborepo monorepo. Svelte 5 SPAs and a SvelteKit storefront/marketing
site for the Sanvi multi-tenant SaaS.

**`CONTRIBUTING.md` is the authority** on the five lint-enforced
non-negotiables (no hardcoded strings, no hardcoded design values, no `fetch`
outside `@sanvi/api-client`, no import-boundary violations, a11y as a build
gate) and on the tooling quirks. Read it before writing components; it is not
duplicated here.

## Layout

```
apps/storefront/       SvelteKit — tenant-facing store
apps/marketing/        SvelteKit — public marketing site
apps/admin/            Svelte SPA — tenant admin console
apps/platform-admin/   Svelte SPA — platform operator console
packages/ui/           shared components; imports no data layer
packages/api-client/   the only place `fetch` is allowed; generated from OpenAPI
packages/design-tokens/ `var(--sanvi-*)` source of truth
packages/lint-gates/   the check:* gate implementations
docs/phase-NN-*/       plans and specs per phase
```

Dependency versions are pinned in `pnpm-workspace.yaml`'s `catalog:` — add or
bump there, then reference `"catalog:"` from the package.

## Commands

| Goal | Command |
| --- | --- |
| Install | `corepack enable && pnpm install` |
| Dev (all apps) | `pnpm dev` |
| Type-check | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Test | `pnpm test:quiet` |
| One package | `pnpm --filter @sanvi/ui test` |
| All gates | `pnpm check:quiet` |
| Regenerate API types | `pnpm generate:api` |

Phase-11 measurement harnesses (reporting-only; `scripts/perf-profiles.json`
pins device/throttling/tool versions, and every artifact records the profile
it ran under — `bench:compare` refuses cross-profile comparisons):

| Goal | Command |
| --- | --- |
| Per-app **and per-route** budget table | `pnpm check:budget --report-only` (budget values: `scripts/budgets.json`) |
| Lighthouse, per app per locale | `pnpm check:lighthouse` (needs `pnpm build` + the pinned Chrome) |
| Axe sweep + route-coverage report | `pnpm check:a11y` (sweep list: `scripts/a11y-routes.json`) |
| Full harness run → committed artifact | `pnpm bench:run <name>` → `benchmarks/frontend/<name>.json` |
| Diff two artifacts, fails on regression | `pnpm bench:compare <a> <b>` |

`test:quiet` and `check:quiet` are the same gates as `test` / `check:all` with
`--output-logs=errors-only` and Vitest's `dot` reporter: a passing package
prints nothing, a failing one prints its full output. Use them for anything
that reads the output as text rather than watching it.

## Cost notes

- Scope to one package with `--filter` while iterating; Turbo's cache makes the
  full run cheap only when nothing upstream changed.
- Turbo's `ui: "tui"` is interactive. Non-TTY runs fall back to streaming on
  their own; set `TURBO_UI=stream` to force it.
