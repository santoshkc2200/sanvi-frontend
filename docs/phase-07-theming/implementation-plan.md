# Phase 07 — Theming & Template Runtime (frontend)

**Target version:** 0.8.0
**Depends on:** frontend 00 (token-only styling gate), 01, 06; backend 07
**Unlocks:** tenant-branded storefronts; a theme marketplace later

## Goal

A runtime that applies a backend-resolved theme — tokens, layouts, assets, typography — to the
storefront per request, plus a theme editor where tenant staff can change colors, fonts, logos, and
layouts and see the result before publishing. New themes install as data; the app does not redeploy.

## Scope

**In**
- `@sanvi/theme-runtime`: applying a `ResolvedTheme`, CSS variable injection, layout/slot rendering.
- Storefront integration: SSR theme resolution, zero flash of unstyled/unbranded content.
- Theme editor in `admin`: theme gallery, token overrides, brand assets, layout arrangement, live
  preview, publish/rollback.
- Template system: layouts composed from slots and blocks, driven by the theme manifest.
- Visual regression across themes and locales.

**Out**
- Theme authoring for third parties (a documented artifact format exists; the authoring toolkit is a
  later phase).
- Arbitrary JavaScript in themes — deliberately not supported (see risks).

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Application mechanism | Server-injected `:root { --token: value }` block in the SSR HTML head, plus a per-tenant stylesheet URL with a content hash | No flash, cacheable, and a theme change is one cache key |
| Component contract | Components consume semantic tokens only (enforced since phase 00) | Re-theming touches zero component code |
| Layouts | Manifest-declared layouts with named slots; blocks registered in a `BlockRegistry` and rendered dynamically | Tenants rearrange; developers add block types |
| Blocks | A fixed, versioned catalog of block components (hero, feature grid, testimonial, CTA, product grid…) with typed props | A safe, testable surface — unlike free-form HTML |
| Preview | A signed preview token renders the draft in an isolated route with `noindex`, viewable in device frames | Preview must be exactly what publishing produces |
| Editing model | Draft → preview → publish, with rollback to any prior revision | Nobody edits a live storefront by accident |
| Custom CSS | Entitlement-gated, sanitised server-side, scoped under a wrapper class, size-capped | Power users want it; it must not become a cross-tenant XSS vector |
| Fonts | Chosen from a curated, self-hosted set with locale coverage declared; no arbitrary remote font URLs | CSP integrity, performance, and CJK coverage |
| Dark mode | A theme-provided token set plus `prefers-color-scheme`, with a tenant-level "force light/dark/auto" | Users expect it; tenants sometimes need brand control |

## Deliverables

### 1. `@sanvi/theme-runtime`

```ts
export function applyTheme(resolved: ResolvedTheme): void          // client-side swap (editor preview)
export function themeStyleTag(resolved: ResolvedTheme): string     // SSR-inlined :root block
export const theme: Readable<ResolvedTheme>
export function registerBlock(type: string, component: Component, schema: BlockSchema): void
export function renderLayout(layout: LayoutName, data: PageData): ComponentTree
```

SSR path: `hooks.server.ts` (slot reserved in phase 01) fetches the resolved theme by host, caches by
ETag, and the root layout inlines the token block and the font preloads for the negotiated locale.
Cache is shared across requests for the same tenant and invalidated by ETag change — a publish is
visible on the next request without a deploy or a purge.

### 2. Theme editor (`admin`)

| Screen | Contents |
|---|---|
| Gallery | Available themes (entitlement-filtered) with previews, current theme marked, version and changelog |
| Brand | Logo (light/dark), favicon, OG image, upload with crop/validation, colour extraction suggestion |
| Colors | Semantic token editors with live contrast feedback; failing pairs are blocked with an explanation and a suggested fix |
| Typography | Font pairing from the curated set, scale, and the locale note that a font must cover Japanese if the tenant serves `ja` |
| Layout | Per-page slot arrangement: drag to reorder, add/remove blocks, configure block props; locked slots (checkout) are visibly locked |
| Preview | Side-by-side desktop/mobile, locale switcher, light/dark toggle |
| Publish | Diff against live, publish, rollback list with timestamps and authors |

Editing is autosaved to the draft; publishing is explicit and confirms what changes.

### 3. Block catalog (v1)

`Hero`, `FeatureGrid`, `RichText`, `ImageBanner`, `ProductGrid`, `Testimonials`, `FAQ`, `CTA`,
`ContactForm`, `Footer`, `Header`, `Spacer`. Each block: typed schema (drives the editor form
automatically), locale-map text fields, responsive by default, accessible by construction, visual
test per theme. Block versioning: a block's schema change ships a migration so existing tenant
layouts keep rendering.

### 4. Storefront integration

- Root layout renders the theme's `Header`/`Footer` and the page's layout tree.
- Asset URLs are absolute CDN URLs from the resolved theme; CSP is extended through `@sanvi/csp` to
  include the theme asset origin — one place, not per app.
- Zero flash: tokens are inline in the SSR head, fonts preloaded, no client-side theme fetch on the
  critical path.
- Fallback: if theme resolution fails, render the base theme rather than an error — a broken theme
  must never take a storefront down.

## Work breakdown

1. `theme-runtime` package: token application (SSR + client), theme store, ETag caching.
2. Block registry, schema-driven prop forms, and the v1 block catalog with tests and stories.
3. Layout renderer with slot resolution, locked-slot enforcement, and unknown-block tolerance.
4. Storefront SSR integration, font preloading per locale, fallback behaviour.
5. Theme editor screens: gallery, brand, colors, typography, layout arranger.
6. Live preview with signed tokens, device frames, locale/dark-mode toggles.
7. Publish/rollback with diff view and revision history.
8. Contrast checking in the editor (the same rules the backend enforces at publish time).
9. Asset upload with validation, cropping, and format conversion.
10. Visual regression matrix: themes × locales × light/dark on key pages.

## Testing

- Component: every block in every theme, at three breakpoints, with axe.
- Unit: token merge/application, ETag caching, layout tree construction, unknown-block handling,
  contrast calculation parity with the backend implementation.
- E2E: change a brand colour → preview shows it → publish → storefront reflects it on next request →
  rollback restores it.
- Failure: malformed theme payload renders the base theme, logs an error, and does not break the page.
- Performance: theme application adds no measurable CLS; fonts do not push LCP past budget.
- Security: custom CSS attempting `url(javascript:…)`, `@import`, or breaking out of the scope
  wrapper is neutralised (fixture corpus shared with the backend sanitiser tests).

## Security

- No theme-supplied JavaScript, ever. Blocks are our components; themes only compose and style them.
- Custom CSS is sanitised server-side (frontend does not trust its own sanitisation), scoped, capped.
- Uploaded SVGs are sanitised or rasterised; theme asset origins are explicitly allow-listed in CSP.
- Preview tokens are short-lived, single-tenant, `noindex`, and never leak the draft to search engines.

## Acceptance criteria

- [ ] A tenant changes logo, colours, fonts, and homepage layout, previews, and publishes — and the
      storefront reflects it on the next request with no flash and no deploy.
- [ ] Rollback restores the previous appearance exactly.
- [ ] An accessibility-failing colour pair cannot be published without an explicit, recorded override.
- [ ] Installing a new theme (backend artifact) makes it appear in the gallery with no frontend change.
- [ ] Visual regression suite covers themes × locales and blocks regressions in CI.
- [ ] A deliberately corrupted theme payload degrades to the base theme without an outage.

## Risks

| Risk | Mitigation |
|---|---|
| Tenants build unusable storefronts | Locked critical slots, contrast gates, sensible block defaults, "reset section" and full rollback |
| Visual regression matrix becomes unmanageably large | Key screens only, sampled themes, block-level tests for the rest |
| Theme flexibility conflicts with accessibility guarantees | Semantic tokens only, contrast enforcement, a11y baked into blocks rather than left to composition |
| Custom CSS abuse | Entitlement gate, server-side sanitisation, scoping, size cap, shared fuzz corpus |
| Block schema changes break existing layouts | Block versioning with migrations, and unknown-block tolerance in the renderer |
