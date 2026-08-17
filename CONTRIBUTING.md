# Contributing to sanvi-frontend

## Setup

```bash
nvm use          # or asdf, volta, etc. — matches .node-version
corepack enable
pnpm install
pnpm dev          # turbo run dev --parallel, all four apps
```

Copy `.env.example` to `.env` (and each app's own `.env.example` where present) before running
anything that talks to the backend.

## The five non-negotiables

These are lint-enforced from phase 00, not a style guide you have to remember:

1. **No hardcoded user-facing strings.** Every string is a prop (`labels`, a `COPY` object) today,
   and a `@sanvi/i18n` call from phase 06. `pnpm check:i18n` flags string literals in `.svelte`
   templates and user-facing attributes (`aria-label`, `alt`, `placeholder`, `title`). False
   positive? Suppress it with `<!-- sanvi-i18n-ignore -->` immediately before the specific text or
   tag — not a config allow-list, so every exception is visible in review.
2. **No hardcoded colors, fonts, spacing, or radii.** Only `var(--sanvi-*)` tokens from
   `@sanvi/design-tokens`. `pnpm check:tokens` flags raw hex/`rgb()`/`hsl()` colors and raw
   px/rem/em lengths in `<style>` blocks and inline `style="..."`. Suppress a false positive with a
   trailing `/* sanvi-tokens-ignore */` comment on the same line, with a one-line reason above it —
   see `packages/ui/src/Dialog.svelte`'s backdrop rule for the pattern.
3. **No `fetch` outside `@sanvi/api-client`.** ESLint's `no-restricted-globals` enforces this
   (`eslint.config.js`); `packages/api-client/src/client.ts` is the only exception.
4. **No import-boundary violations.** `ui` never imports `api-client`; apps never import each
   other; nothing reaches into another package's `src/**` directly — only through its declared
   entry point. `pnpm check:boundaries` enforces this.
5. **Accessibility is a build gate.** `eslint-plugin-svelte`'s a11y rules run at error level, and
   every `ui` component test asserts `expect(container).toHaveNoViolations()`
   (`@sanvi/test-config/axe`).

Disabling any of these for a file needs a linked ADR in the PR, not a one-line ignore comment with
no explanation.

## Tooling notes

- `packages/biome-config/biome.json` turns off `complexity/useLiteralKeys`. It conflicts with
  TypeScript's `noPropertyAccessFromIndexSignature` (set in `@sanvi/ts-config/base.json`): for a
  `Record<string, string>`-typed value, Biome wants `.foo` and `tsc` requires `['foo']` on the same
  object. `tsc`'s is a hard compiler error; Biome's is a style preference, so it loses.
  (`biome.json` is JSONC and normally supports `//` comments, but a comment inside a config reached
  through `extends` broke parsing in the version this repo pins — keep this rule's rationale here
  instead of inline.)
- An `overrides[].includes` glob in `packages/biome-config/biome.json` (the shared config every
  package's `biome.json` extends) is resolved **relative to whichever package's own `biome.json`
  governs the file being linted** — not the workspace root. A pattern like `**/lint-gates/**` never
  matches a file inside `packages/lint-gates/`, because relative to that package's own config the
  path is just `src/check-i18n.mjs` — the `lint-gates` segment is gone. Patterns anchored to a
  package name only work from the shared config for genuinely repo-wide shapes (`**/*.svelte`,
  `**/__tests__/**`, `**/scripts/**`); a rule that only applies inside one specific package belongs
  in that package's own `biome.json` instead, with a path relative to that package
  (`packages/lint-gates/biome.json`'s `overrides: [{ includes: ["src/**"], ... }]` is the pattern —
  see that file).

## Adding a component to `@sanvi/ui`

1. Create `packages/ui/src/YourComponent.svelte`. Runes (`$props`, `$state`, `$derived`,
   `$effect`), typed `Props` interface, only `var(--sanvi-*)` for anything visual.
2. If it renders text, every string is a prop with a sensible English default — see
   `Alert.svelte`/`Field.svelte` for the pattern.
3. Export it from `packages/ui/src/index.ts`.
4. Add `packages/ui/__tests__/YourComponent.test.ts` — states, keyboard path if interactive, and an
   axe check (`import { axe } from '@sanvi/test-config/axe'`). Component content passed as
   `children` in a test uses `createRawSnippet` (see `Button.test.ts`); a snippet that takes
   parameters needs a small fixture `.svelte` file instead (see `__tests__/fixtures/FieldWithInput.svelte`).
5. Add `packages/ui/src/YourComponent.stories.svelte` (`@storybook/addon-svelte-csf` format —
   `{#snippet children()}` per `<Story>`).
6. `pnpm --filter @sanvi/ui test && pnpm --filter @sanvi/ui check`.

## Adding a package

1. `packages/your-package/package.json` — name it `@sanvi/your-package`, `"private": true`.
2. `tsconfig.json` extending `@sanvi/ts-config/svelte` (has `.svelte` files) or
   `@sanvi/ts-config/bundler` (pure TS/Node).
3. `biome.json`: `{ "extends": "//" }`.
4. If it has tests: `vitest.config.ts` importing `@sanvi/test-config/base` (Node) or
   `@sanvi/test-config/jsdom` (components — merge in `@sveltejs/vite-plugin-svelte`, see
   `packages/ui/vitest.config.ts`).
5. Add it to `docs/README.md`'s workspace layout table and to `docs/architecture-overview.md` §2 if
   it introduces a new dependency direction.
6. Respect the import boundaries above — `pnpm check:boundaries` will catch a violation, but design
   the dependency direction on purpose rather than finding out from the lint.

## Adding a route

**SvelteKit apps (`marketing`, `storefront`):** a route is a directory under `src/routes`. Every
route inherits the app's CSP from `hooks.server.ts` — don't add a per-route policy. Data loading
goes in `+page.ts`/`+page.server.ts` `load` functions, never `onMount`, for anything the page needs
to render. New routes that must not be prerendered (forms, per-request data) need
`export const prerender = false`.

**Vite SPA apps (`admin`, `platform-admin`):** add an entry to the `routes` map in `src/App.svelte`
(lazy `import()` for code-splitting) and a `NAV` entry if it belongs in the primary nav. Route
components live in `src/routes/`.

## Dependency policy

No new dependency without a note in the PR: what it's for, its gzip/install size, its maintenance
status (last publish, open issues), and its licence. The PR template has a section for this.
Copyleft licences (GPL/AGPL) are blocked in shipped packages by the licence-check CI job.

## Testing levels

| Level | Tooling | Where |
|---|---|---|
| Unit | Vitest, node environment | Pure functions — `csp`'s policy builder, `billing-elements`' money helpers |
| Component | Vitest + Testing Library + axe, jsdom | `ui` and app components |
| E2E smoke | Playwright (chromium + webkit) | Each app's `e2e/` — boots, renders, no console errors, correct CSP |

Every app declares its CSP through `@sanvi/csp`'s `buildContentSecurityPolicyForApp` — never an
ad-hoc policy. SvelteKit apps set it as a response header in `hooks.server.ts`; Vite SPA apps use
`@sanvi/csp/vite`'s `sanviCspMetaPlugin` to inject a `<meta http-equiv>` tag (dev/preview —
production static hosting sets the real header at the CDN, since `frame-ancestors` doesn't work in
a meta tag).

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint on
`commit-msg`: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `perf:`, `ci:`, `build:`.
