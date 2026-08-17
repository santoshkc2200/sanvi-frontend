## What & why

<!-- What changed, and the problem it solves. Link the phase doc / issue. -->

## Definition of Done

- [ ] `pnpm turbo run lint typecheck test build` is green locally
- [ ] `pnpm check:i18n` / `pnpm check:tokens` / `pnpm check:boundaries` pass — no new hardcoded
      strings, no new raw colors/spacing/fonts, no new import-boundary violations
- [ ] `pnpm check:budget` passes, or the bundle-size PR comment explains the regression
- [ ] New/changed components: axe check passes, keyboard path verified manually, Storybook story added
- [ ] New dependency? Noted below (size, maintenance status, licence) — see
      [`CONTRIBUTING.md`](../CONTRIBUTING.md#dependency-policy)
- [ ] Disabling a lint gate? Linked ADR, not a one-line `// biome-ignore`

## New dependency (if any)

<!-- Package, why, bundle size impact, licence, maintenance status. Delete this section if none. -->

## Test plan

<!-- How you verified this — commands run, screenshots/GIFs for UI changes, edge cases covered. -->
