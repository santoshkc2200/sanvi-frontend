# Phase 00 — Foundations & DevSecOps (frontend)

**Target version:** 0.1.0
**Depends on:** nothing (runs in parallel with backend phase 00)
**Unlocks:** every other frontend phase

## Goal

A monorepo where four apps and a dozen packages build, test, lint, and deploy from one command;
where the existing packages are integrated rather than orphaned; and where the rules that make
phases 06 (i18n) and 07 (theming) cheap are enforced by lint from the first commit.

## Scope

**In**
- pnpm workspace + Turborepo pipeline, shared tooling packages, CI/CD.
- Four app shells that build, deploy, and render a real page.
- Integration and rescoping of `design-tokens`, `csp`, `billing-elements`, `course-media`.
- The `ui` package foundation: layout primitives, a handful of core components, docs/storybook.
- Lint gates: no hardcoded strings, no hardcoded design values, no direct `fetch`, a11y rules.

**Out**
- Real features. The apps render placeholder content wired to nothing.
- The generated API client (backend phase 00 has no product endpoints yet) — the *runtime* wrapper
  is built here, generation lands in phase 01.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Package manager | pnpm with workspaces + `catalog:` | Existing packages already use `catalog:`; strict node_modules catches phantom dependencies |
| Task runner | Turborepo with remote cache | Required by the brief; caching is what keeps a 16-package repo fast |
| Framework versions | Svelte 5 (runes), SvelteKit 2, Vite 6, TypeScript 5.7+ | Matches existing package peer deps |
| Lint/format | Biome (already used by `design-tokens` and `csp`) + `eslint-plugin-svelte` for Svelte-specific and a11y rules | Biome is fast and already in the repo; ESLint covers what Biome does not for Svelte |
| Test | Vitest (unit/component) + Playwright (e2e) | Already referenced by existing packages via `catalog:` |
| Scope rename | `@hitox/*` → `@sanvi/*` | The repo is Sanvi; the leftover scope will confuse everyone in a month |
| Component docs | Storybook (or Histoire) for `ui` | Design review and visual regression need a component catalog |
| Deployment | Container images for the SvelteKit apps (node adapter); static hosting + CDN for SPAs | Storefront needs SSR on tenant domains; SPAs do not need a server |
| Node version | Pinned via `.nvmrc` / `engines`, matching the CI image | Reproducibility |

## Deliverables

### 1. Workspace bootstrap

```yaml
# pnpm-workspace.yaml
packages: ["apps/*", "packages/*"]
catalog:
  typescript: ^5.7.0
  vitest: ^2.1.0
  svelte: ^5.0.0
  "@sveltejs/kit": ^2.0.0
  vite: ^6.0.0
  "@playwright/test": ^1.49.0
```

```jsonc
// turbo.json — task graph
{
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**", ".svelte-kit/**", "build/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint":      {},
    "test":      { "dependsOn": ["^build"] },
    "test:e2e":  { "dependsOn": ["build"] },
    "check:i18n":   {},
    "check:tokens": {},
    "check:budget": { "dependsOn": ["build"] }
  }
}
```

### 2. Tooling packages (unblock the existing ones)

- `packages/ts-config` — `base.json`, `svelte.json`, `node.json`. **`design-tokens` and `csp` already
  declare `@hitox/ts-config: workspace:*` and will not install until this exists.**
- `packages/test-config` — shared Vitest config (jsdom + node projects), coverage thresholds,
  Testing Library setup, axe matcher registration.
- `packages/biome-config` — shared Biome settings so every package stops carrying its own copy.

### 3. Existing package integration

| Package | Work |
|---|---|
| `design-tokens` | Rescope, wire `build` into the Turborepo graph, decide the fate of the `astryx-theme` exports, add a Sanvi base theme, keep the DTCG → CSS/TS pipeline, add contrast tests |
| `csp` | Rescope, add per-app policy presets (`marketing`, `storefront`, `admin`, `platform-admin`), extend for Stripe (`https://*.stripe.com` in `script-src`/`frame-src`/`connect-src`) ahead of phases 04/09 |
| `billing-elements` | Rescope; confirm it builds against the workspace Svelte version; its `money.ts` (minor units, `minorUnitExponent`) becomes the shared money utility — JPY correctness in phase 04/06 depends on it |
| `course-media` | Rescope, keep building and testing in CI so it does not rot; no app consumes it until a product phase needs media |

### 4. App shells

Each app gets: routing skeleton, error and 404 pages, CSP from `@sanvi/csp`, tokens imported,
`ui` layout primitives, health/version route, environment config typing, and a deployable build.

- `marketing`: prerendered home + pricing placeholder, SEO defaults (title template, OG tags,
  sitemap, robots), `@sveltejs/adapter-node`.
- `storefront`: SSR, hooks skeleton for tenant/theme/locale (filled in phases 01/06/07), `adapter-node`.
- `admin` / `platform-admin`: Vite SPA, route-level code splitting, app shell with nav, CSP via
  `<meta http-equiv>` in dev/preview (the `csp` package already models the `meta` vs `header`
  distinction and correctly omits `frame-ancestors` for meta delivery).

### 5. `ui` package foundation

- Layout primitives: `Stack`, `Cluster`, `Grid`, `Container`, `Spacer` — all token-driven.
- Core components: `Button`, `Input`, `Select`, `Checkbox`, `Radio`, `Textarea`, `Field` (label +
  error + hint), `Dialog`, `Drawer`, `Toast`, `Table`, `Badge`, `Spinner`, `EmptyState`, `Alert`.
- Every component: typed props, keyboard support, ARIA, focus management, dark mode, RTL-safe logical
  properties, component test + axe check + story.
- No component imports `api-client` or performs I/O.

### 6. Lint gates that make later phases cheap

1. **`check:i18n`** — flags user-facing string literals in Svelte templates and component props
   (allow-list for `data-testid`, class names, etc.). Fails the build.
2. **`check:tokens`** — flags raw color/length/font values in CSS and inline styles; only
   `var(--…)` from the token set is allowed.
3. **Import boundaries** — `ui` cannot import `api-client`; apps cannot import each other; nothing
   imports from another package's `src/**` internals.
4. **`no-restricted-globals: fetch`** outside `api-client`.
5. **a11y rules** from `eslint-plugin-svelte` at error level.

Each gate ships with a fixture proving it fails on a violation — a lint nobody has seen fail is a
lint nobody trusts.

### 7. CI/CD

`pr.yml`: install (frozen lockfile) → `turbo lint typecheck test build check:i18n check:tokens
check:budget` → Playwright smoke on the built apps → bundle-size report as a PR comment → security
gates (`pnpm audit`/OSV, secret scan, license check, SBOM).
`main.yml`: build and push app images, deploy to staging, run e2e against staging, publish Storybook.

Also: Renovate/Dependabot with grouped updates, `.node-version`, pre-commit hooks (format, lint
staged, commit message lint), and a PR template with the DoD checklist.

## Work breakdown

1. `pnpm-workspace.yaml`, `turbo.json`, root scripts, `.gitignore`, editor config, Node pinning.
2. `ts-config`, `test-config`, `biome-config` packages.
3. Rescope and wire the four existing packages; make `pnpm install && turbo build` green.
4. `design-tokens`: Sanvi base theme, light/dark, locale-aware typography dimension, contrast tests.
5. `ui` primitives + core components + Storybook + tests.
6. App shells ×4 with CSP, tokens, error pages, env typing.
7. `api-client` runtime skeleton (typed fetch, problem+json mapping, retry/timeout, request id) —
   generation wired in phase 01.
8. Lint gates + fixtures.
9. CI/CD pipelines, budgets, bundle reporting, staging deploy.
10. `CONTRIBUTING.md`: how to add a component, a package, a route; the five non-negotiables.

## Testing

- Unit: `csp` policy output per app preset; `billing-elements` money helpers (JPY/USD round trips);
  token build output snapshot.
- Component: every `ui` component's states + axe.
- E2E smoke: each app boots, renders, has no console errors, and serves the expected CSP header.
- Meta-tests: each lint gate fails on its fixture.

## Security

- CSP shipped from day one (not "added before launch"), per app, with `frame-ancestors` on
  header-delivered policies.
- Dependency policy: no new dependency without a note in the PR (size, maintenance, licence);
  automated licence check blocks copyleft in shipped packages.
- Secret scanning pre-commit and in CI; no secrets in client bundles — a CI grep asserts no
  `sk_`/`rk_`/private key patterns in build output.
- Source maps uploaded to the error tracker but not served publicly in production.

## Acceptance criteria

- [ ] `pnpm install && pnpm turbo build test lint` is green from a clean clone.
- [ ] All four apps deploy to staging and render their shell with the correct CSP.
- [ ] The four existing packages build, test, and are consumed by at least one app or story.
- [ ] Each of the five lint gates demonstrably fails on its fixture.
- [ ] Bundle budgets are reported on every PR and block regressions.
- [ ] Storybook is published from CI and reviewed by design.

## Risks

| Risk | Mitigation |
|---|---|
| Existing packages assume a repo layout that no longer exists (`hitox-client`, `hitox-admin`, Astryx tokens) | Phase 00 explicitly audits and rewrites those assumptions; comments referencing old apps get updated, not inherited |
| Turborepo cache misconfiguration produces stale builds | Explicit `outputs` per task, remote cache verified with a cache-hit test in CI |
| Four apps quadruple maintenance | Everything shared lives in packages; app code is composition only, and PR review enforces it |
| Lint gates are turned off under deadline pressure | Gates land with fixtures and are listed in the DoD; disabling one requires an ADR |
