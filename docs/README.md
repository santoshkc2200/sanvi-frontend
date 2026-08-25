# sanvi-frontend — Documentation Index

pnpm + Turborepo monorepo. SvelteKit for the storefront and marketing site, Svelte SPAs for the admin
consoles, and a set of shared packages that hold everything more than one app needs.

## How to read these docs

- [`architecture-overview.md`](architecture-overview.md) — workspace shape and the rules every phase
  follows.
- `phase-NN-<slug>/implementation-plan.md` — one plan per delivery phase.
- [`requirements.md`](requirements.md) — numbered `FR-*` / `NFR-*` requirements, from phase 09 onward.
  Tasks trace to these IDs.
- [`tasks/backlog.md`](tasks/backlog.md) — **start here to pick up work.** The status of every task,
  with the task specs in `tasks/phase-NN/` and that phase's ordering in `tasks/phase-NN/README.md`.
- [`tasks/definition-of-done.md`](tasks/definition-of-done.md) — the exit bar every task must clear.
- The cross-project phase map is jointly owned and lives in the backend repo, at
  `sanvi-backend/docs/shared/roadmap.md` — one canonical copy, next to the API contract. Changes to
  it are reviewed by both tracks. (With both repos cloned as siblings:
  [`../../sanvi-backend/docs/shared/roadmap.md`](../../sanvi-backend/docs/shared/roadmap.md).)

## Working the backlog

From phase 09 the delivery layers are: the roadmap (why the phase exists) → the phase
implementation plan (what and how) → [`requirements.md`](requirements.md) (numbered requirements) →
[`tasks/`](tasks/backlog.md) (one agent-executable spec per slice, ordered by that phase's
`tasks/phase-NN/README.md`). Every layer traces to the one above it: every requirement is covered
by at least one task, and every task names a requirement. A reviewer checks that by reading.

Cross-track coordination lives in the tasks themselves: a task blocked on `sanvi-backend` work says
so in a `**Blocked by (cross-repo):**` line. There is no shared schedule document.

Status is recorded by hand in two places in the same commit — the task file's `**Status:**` line and
its row in [`tasks/backlog.md`](tasks/backlog.md). Tasks are executed with the Superpowers workflow
(`superpowers:executing-plans`, or `superpowers:subagent-driven-development` for a fresh subagent per
task).

Frontend task IDs are independent of backend task IDs; `TASK-004` means different work in each repo.
Phases 00–08 predate this practice and stay documented by their implementation plans alone.

## Phases

| # | Phase | Version | Plan |
|---|-------|---------|------|
| 00 | Foundations & DevSecOps | 0.1.0 | [plan](phase-00-foundations-devsecops/implementation-plan.md) |
| 01 | Tenancy, Routing & API Client | 0.2.0 | [plan](phase-01-tenancy-routing/implementation-plan.md) |
| 02 | Authentication & Authorization UX | 0.3.0 | [plan](phase-02-auth-ux/implementation-plan.md) |
| 03 | Platform Admin & Tenant Admin Consoles | 0.4.0 | [plan](phase-03-admin-consoles/implementation-plan.md) |
| 04 | Pricing, Checkout & Billing UI | 0.5.0 | [plan](phase-04-billing-ui/implementation-plan.md) |
| 05 | Privacy Centre, Consent & Opt-Out | 0.6.0 | [plan](phase-05-privacy-consent/implementation-plan.md) |
| 06 | Internationalization & Localization | 0.7.0 | [plan](phase-06-i18n-l10n/implementation-plan.md) |
| 07 | Theming & Template Runtime | 0.8.0 | [plan](phase-07-theming/implementation-plan.md) |
| 08 | Domain Connect & Purchase Wizard | 0.9.0 | [plan](phase-08-domains/implementation-plan.md) |
| 09 | Tenant Payments & Storefront Checkout | 0.10.0 | [plan](phase-09-tenant-payments/implementation-plan.md) |
| 10 | Advertising Manager & ROAS Dashboard | 0.11.0 | [plan](phase-10-advertising/implementation-plan.md) |
| 11 | Performance, Accessibility & GA | 1.0.0 | [plan](phase-11-hardening-ga/implementation-plan.md) |

## Workspace layout (target)

```
sanvi-frontend/
├── pnpm-workspace.yaml          # packages/*, apps/*, catalog: pinned shared deps
├── turbo.json                   # task graph, caching, remote cache
├── apps/
│   ├── marketing/               # SvelteKit — public landing, pricing, docs, blog (mostly prerendered)
│   ├── storefront/              # SvelteKit — tenant-facing, SSR, custom domains, themed
│   ├── admin/                   # Svelte SPA (Vite) — tenant admin console
│   └── platform-admin/          # Svelte SPA (Vite) — platform operator console
├── packages/
│   ├── design-tokens/           # EXISTS — DTCG → CSS vars / TS via Style Dictionary
│   ├── csp/                     # EXISTS — Content-Security-Policy builder
│   ├── billing-elements/        # EXISTS — Stripe Elements forms + money helpers
│   ├── course-media/            # EXISTS — upload, HLS, captions, images (adopted when needed)
│   ├── ui/                      # component library (Svelte 5 runes, token-driven, a11y-first)
│   ├── i18n/                    # message catalogs + runtime + formatting
│   ├── api-client/              # generated from OpenAPI + typed fetch wrapper
│   ├── auth/                    # Ory Kratos flows, session store, guards
│   ├── tenant/                  # tenant context resolution, entitlements, feature gates
│   ├── theme-runtime/           # resolved-theme application, layout/slot registry
│   ├── analytics/               # consent-aware event tracking
│   ├── forms/                   # schema-driven forms + validation (shared with backend contracts)
│   ├── utils/                   # small shared helpers, no framework coupling
│   ├── ts-config/               # shared tsconfig bases            (required by existing packages)
│   ├── test-config/             # shared vitest/playwright config  (required by existing packages)
│   └── biome-config/            # shared lint/format config
└── docs/                        # this folder
```

## Non-negotiables

1. **No hardcoded user-facing strings.** Every string goes through `@sanvi/i18n`. Lint-enforced from
   phase 00, so phase 06 is a translation exercise, not a refactor.
2. **No hardcoded colors, fonts, spacing, or radii.** Only tokens from `@sanvi/design-tokens`.
   Lint-enforced, so phase 07 can re-theme the whole product without touching components.
3. **No `fetch` to the API outside `@sanvi/api-client`.** Types, auth, tenant headers, error mapping,
   and retries live in one place.
4. **Accessibility is a build gate**, not a phase: `eslint-plugin-svelte` a11y rules plus axe checks
   in component tests from day one.
5. **Every app declares its CSP through `@sanvi/csp`** — no per-app ad-hoc policies.

## Existing packages: what changes in phase 00

- Rename the npm scope `@hitox/*` → `@sanvi/*` across the four existing packages.
- Create `ts-config` and `test-config`, which `design-tokens` and `csp` already depend on
  (`workspace:*`) but which do not exist yet.
- Define the pnpm `catalog:` entries the existing packages reference (`vitest`, `typescript`).
- `design-tokens` currently ships an `astryx-theme` CSS export and Astryx-specific token extensions;
  phase 00 decides whether that becomes the Sanvi base theme or is dropped, and phase 07 formalises
  the theme artifact format around it.
