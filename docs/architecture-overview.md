# Frontend Architecture Overview

Phase-independent rules. Every plan in this folder assumes them.

## 1. Four apps, one system

| App | Framework | Rendering | Audience | Host |
|---|---|---|---|---|
| `marketing` | SvelteKit | Prerendered + ISR-style revalidation | Anonymous visitors | `sanvi.app`, `www` |
| `storefront` | SvelteKit | SSR (+ prerender where safe) | Tenant's end customers | `<slug>.platform.sanvi.app`, custom domains |
| `admin` | Svelte SPA (Vite) | Client-rendered behind auth | Tenant staff | `app.sanvi.app` |
| `platform-admin` | Svelte SPA (Vite) | Client-rendered behind auth + MFA | Sanvi operators | `admin.sanvi.app` |

Why split admin from platform-admin: different privilege tiers, different blast radius, and a bug in
tenant admin must never be able to reach operator capability. They share every package, so the cost
is a build target, not duplicated code.

Why SSR for the storefront: SEO, first-paint on the tenant's own domain, per-request theming and
locale, and server-held session cookies.

Why SPA for admin consoles: no SEO requirement, heavy stateful interaction, and no need to run a
Node server per tenant surface.

## 2. Package boundaries

- `ui` depends on `design-tokens` and `i18n` only. It never imports `api-client`, never fetches,
  never reads global state. Components take props and emit events.
- `api-client` is generated from the backend OpenAPI documents plus a thin hand-written runtime
  (auth, tenant header, retries, problem+json → typed error). Regenerated in CI; drift fails the build.
- `tenant`, `auth`, `theme-runtime`, `analytics` are runtime services with an explicit init and a
  documented SSR story (what runs on the server, what hydrates).
- `consent` (phase 05) is a framework-free state machine over the backend's directive snapshot: it
  never fetches — the app injects `@sanvi/api-client` callbacks for server sync — and it owns the
  first-party consent cookie, GPC handling, notice re-prompt logic, and the allow-listed third-party
  script gate. `@sanvi/analytics` reads its decisions and drops (never queues) events whose purpose
  is not `allowed`; payloads are flat and PII-checked at the package boundary.
- Apps compose. Business logic that two apps share moves into a package; logic that one app has stays
  in that app.

Dependency direction is enforced by an import lint: `apps → packages → design-tokens`, never upward,
never sideways between apps.

## 3. Svelte conventions

- **Svelte 5 with runes** (`$state`, `$derived`, `$effect`, `$props`) — the existing packages already
  target `svelte ^5`.
- Data loading in SvelteKit `load` functions, never in `onMount` for anything the page needs to show.
- Stores only for genuinely global state (session, tenant, theme, locale). Everything else is props
  or context.
- Component contract: typed props, no implicit globals, no direct DOM mutation outside `$effect`,
  slots/snippets for composition.
- Progressive enhancement for storefront forms (SvelteKit form actions, working without JS where the
  flow allows it).

## 4. Styling & theming

- CSS custom properties emitted by `design-tokens` are the only source of visual values. Components
  reference `var(--color-background-primary)`, never a hex code.
- No utility-CSS framework. Tenant theming is per-request CSS variable substitution; a build-time
  utility framework would fight that. Scoped Svelte styles plus a small shared layer primitives set
  (`Stack`, `Grid`, `Cluster`) cover layout.
- Dark mode is a token set, not a component concern.
- Locale-aware typography (line-height, letter-spacing, font stacks) is a token dimension, so
  Japanese text does not inherit Latin-tuned metrics.

## 5. Data, state, and errors

- Server state comes from `api-client` with a small query layer: request dedupe, cache with explicit
  invalidation, optimistic updates where the API is idempotent.
- Client state is local by default; global stores are enumerable and few.
- Every request path handles four states explicitly: loading, empty, error, success. A component that
  only handles success fails review.
- Backend errors arrive as RFC 9457 problem+json and are mapped to typed errors with a localized
  message; raw error text is never rendered.

## 6. Performance budgets (enforced from phase 00)

| Surface | Budget |
|---|---|
| Storefront initial JS (gzip) | ≤ 100 KB |
| Storefront LCP (p75, mobile) | ≤ 2.0 s |
| Storefront CLS / INP | ≤ 0.1 / ≤ 200 ms |
| Admin initial JS (gzip) | ≤ 250 KB, routes lazily loaded |
| Any single route chunk | ≤ 50 KB |

CI fails on budget regression. Fonts are self-hosted and subset — Japanese subsets are large enough
that this is a real budget item, not a formality.

Since phase 11 (TASK-031) the enforced values live in `scripts/budgets.json` (per app **and per
route**, seeded from the current build + margin; the table above is the target TASK-022 tightens to,
at which point the gate becomes blocking). The measurement harnesses are pinned by
`scripts/perf-profiles.json`; every artifact under `benchmarks/frontend/` embeds the profile it ran
under and `pnpm bench:compare` refuses cross-profile comparisons.

## 7. Accessibility

WCAG 2.2 AA as the baseline: semantic HTML first, keyboard paths for every interaction, visible focus,
labelled controls, live-region announcements for async results, and colour contrast enforced at the
token level (the theming pipeline rejects failing palettes). Automated axe checks run in component
and e2e tests; manual keyboard and screen-reader passes are part of each phase's DoD.

## 8. Security

- CSP from `@sanvi/csp` per app; the storefront additionally allows Stripe origins (phase 09) and
  theme asset origins (phase 07). No `unsafe-eval` in production; `unsafe-inline` only where a
  framework genuinely requires it, documented per app.
- Session cookies are set by the backend/Ory; the SPA never stores tokens in `localStorage`.
- All user-supplied HTML (tenant content, theme copy) is sanitised before render; `{@html}` requires
  an explicit review comment and a sanitiser call.
- Third-party scripts (ad pixels, analytics) load only from an allow-list and only once the phase-05
  directive for their purpose resolves to `allowed` — consent in EU/UK/JP, absence of an opt-out
  (including a GPC signal) in the US. The loader waits for the resolution; it never fires optimistically.

## 9. Testing

| Level | Tooling | Scope |
|---|---|---|
| Unit | Vitest | Utilities, stores, formatting, guards |
| Component | Vitest + Testing Library + axe | `ui` and app components, all four states |
| Contract | Generated client vs OpenAPI + MSW handlers | API shape drift |
| E2E | Playwright (chromium + webkit, desktop + mobile) | Critical journeys per app |
| Visual | Playwright screenshots per theme × locale | Theming and CJK regressions |
| Perf | Lighthouse CI + bundle analysis | Budgets |

Every phase adds its journeys to the e2e suite; the suite is a release gate, not a nightly.
