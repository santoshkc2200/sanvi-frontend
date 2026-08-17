# Phase 06 — Internationalization & Localization (frontend)

**Target version:** 0.7.0
**Depends on:** frontend 00 (the no-hardcoded-strings gate), backend 06
**Unlocks:** the Japanese market

## Goal

Every app runs in English and Japanese with correct typography, formatting, routing, and SEO. Because
phase 00 lint-gated hardcoded strings, this phase is catalog work, locale plumbing, and CJK
typography — not a refactor of every component.

## Scope

**In**
- `@sanvi/i18n`: message catalogs, runtime, formatters, locale detection and switching.
- Locale routing and SEO for the SSR apps (storefront, marketing).
- Japanese typography, fonts, and input handling (IME).
- Locale-aware formatting: dates, numbers, currency, addresses, names, sorting.
- Translation workflow: extraction, coverage gates, pseudo-localisation, translator handoff.

**Out**
- Backend-emitted strings (backend phase 06 owns emails, invoices, problem details).
- Right-to-left languages — logical CSS properties are used throughout so RTL is possible later, but
  no RTL locale ships now.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Library | **Paraglide JS (inlang)** — compiled, tree-shaken, type-safe messages | Only used messages ship; missing keys are compile errors; no runtime catalog fetch on the critical path |
| Message format | ICU MessageFormat | Same syntax as the backend catalogs; handles plurals and CJK counters |
| Catalog location | `packages/i18n/messages/{locale}.json`, namespaced by feature (`billing.plan.title`) | One place to hand to translators; namespaces map to ownership |
| Storefront routing | Path prefix `/{locale}/…` with the tenant's default locale unprefixed, plus `hreflang` and canonical tags | Best SEO story; unprefixed default avoids ugly URLs for single-locale tenants |
| Admin apps | Locale from user preference, no URL prefix | No SEO requirement; a URL prefix would only add complexity |
| Detection order | URL prefix → user preference → tenant default → `Accept-Language` → `en` | Mirrors the backend exactly, so client and server never disagree |
| Fonts | Self-hosted Noto Sans JP, subset, `unicode-range` split, preloaded only for `ja` | The full JP font is megabytes; naive loading destroys the LCP budget |
| Formatting | Native `Intl` (`DateTimeFormat`, `NumberFormat`, `ListFormat`, `RelativeTimeFormat`, `Collator`) | No dependency, correct, and already in every target browser |
| Currency | `billing-elements`' minor-unit helpers + `Intl.NumberFormat` | JPY has zero decimals; the existing `minorUnitExponent` already encodes this |
| Text expansion | Pseudo-localisation mode in dev/CI plus visual tests at 130 % length | Catches layout breakage before translators do |

## Deliverables

### 1. `@sanvi/i18n`

```ts
export const locale: Readable<Locale>
export function setLocale(l: Locale): Promise<void>       // persists + refetches locale-dependent data
export const t: Messages                                   // typed, compiled accessor
export const fmt: {
  date(d: Date | string, style?): string
  number(n: number, opts?): string
  money(minor: number, currency: string): string           // exponent-aware
  relative(d: Date): string
  list(items: string[]): string
  name(person: { given: string; family: string }): string  // ja → 家族名 given, honorific-aware
  address(a: Address): string                              // country-specific template
  collator(): Intl.Collator
}
```

Server-side: locale resolved in `hooks.server.ts` (slot reserved in phase 01) and injected into
`load`, so SSR HTML is already in the right language — no flash of English.

### 2. Locale routing & SEO (storefront, marketing)

- `/{locale}` segment with a `reroute`/param matcher; the tenant's default locale is served
  unprefixed and redirects duplicates to the canonical URL.
- `<html lang>` and `dir` set server-side; `hreflang` alternates for every locale a tenant enables;
  canonical URLs; localized `sitemap.xml`; localized OG/Twitter metadata.
- Locale switcher preserves the current path and query, and persists the choice.
- 404s, error pages, and redirects all stay within the locale.

### 3. Japanese typography and interaction

- Font stack with Noto Sans JP subset, `font-display: swap`, preload only when the negotiated locale
  is `ja`, and a Latin fallback that does not shift layout.
- CJK line breaking: `line-break: strict`, `overflow-wrap: anywhere` where appropriate, no reliance on
  spaces for wrapping, `text-spacing` for mixed Latin/CJK where supported.
- Locale-tuned typography tokens: line-height (JP needs more), letter-spacing (JP needs less or
  none), font-size adjustments — a locale dimension in `design-tokens`, not per-component overrides.
- IME-safe inputs: never intercept keystrokes during composition (`compositionstart`/`end`) —
  autocomplete, search-as-you-type, and Enter-to-submit all respect composition state.
- Input normalisation: full-width → half-width (NFKC) for emails, numbers, and slugs, with the
  original preserved for display.
- Form fields ordered per locale (Japanese address: postal code first, then prefecture/city), with
  postal-code lookup where available.

### 4. Translation workflow

```
develop with English messages → CI extracts keys → coverage report per locale
  → missing keys block release for shipped surfaces (en/ja at 100 %)
  → translator handoff via the inlang project format (or exported JSON)
  → review in a preview deployment with pseudo-localisation and real ja side by side
```

`pnpm i18n:check` (missing, orphaned, malformed ICU, over-length for constrained slots) runs in CI.

### 5. Localized content from tenants

Tenant-authored content (theme copy, plan descriptions, storefront text) arrives as locale maps.
UI for editing them is a tabbed editor per locale with a "not yet translated" indicator and a copy
from-source action — plus a fallback badge on the storefront when content falls back to another
locale, visible to tenant staff only.

## Work breakdown

1. `@sanvi/i18n` package: Paraglide setup, catalog structure, typed accessors, formatter suite.
2. Locale detection/resolution in SSR hooks and SPA boot; persistence; API `Accept-Language` wiring.
3. Locale routing, canonical/hreflang/sitemap, switcher component.
4. Token work: locale typography dimension in `design-tokens`; font subsetting and preload strategy.
5. IME-safe input primitives in `ui`; normalisation utilities; locale-aware form field ordering.
6. Message extraction from all existing surfaces (phases 00–05) and their Japanese translation.
7. Locale-map editors for tenant content.
8. Pseudo-localisation mode + visual regression at expanded lengths.
9. CI gates: coverage, ICU validity, bundle impact of fonts.

## Testing

- Unit: detection order matrix; formatter output per locale (dates, JPY vs USD, name order, address).
- Component: pseudo-localised rendering of every `ui` component without overflow or clipping.
- Visual regression: every key screen × {en, ja} × {light, dark}.
- E2E: switch locale and see it persist across navigation, reload, and SSR; correct `lang`, canonical,
  and `hreflang` in the HTML; IME composition does not trigger premature submission (a scripted
  composition test, since this bug is invisible to normal typing tests).
- Performance: `ja` font strategy stays within the LCP budget (Lighthouse gate on a `ja` page).
- Coverage: CI fails on a missing `ja` key in a shipped namespace.

## Security

- Locale values are validated against the supported set before use in routing or `Intl` calls.
- Translated strings are treated as data: no `{@html}` on catalog content without sanitisation.
- Tenant-authored localized content is sanitised on render like any other tenant content.

## Acceptance criteria

- [ ] Every app renders fully in Japanese with no untranslated strings on shipped surfaces.
- [ ] Server-rendered pages arrive in the correct language — no flash of English.
- [ ] Japanese pages meet the same LCP budget as English ones.
- [ ] IME input works correctly in every text field, including search and inline editing.
- [ ] JPY prices render with no decimals everywhere they appear.
- [ ] Adding a third locale requires a catalog and a config entry, not code changes (demonstrated).

## Risks

| Risk | Mitigation |
|---|---|
| Japanese font weight blows the performance budget | Subsetting, `unicode-range`, locale-conditional preload, budget gate in CI |
| Text expansion breaks layouts | Pseudo-localisation in CI + visual tests + no fixed-width text containers |
| IME bugs slip through | Explicit composition-event tests; IME behaviour on the review checklist for any input component |
| Translation lag blocks releases | Coverage gate applies to shipped namespaces only; unshipped features can carry English while in progress |
| Locale/tenant/theme interactions multiply test surface | Visual matrix limited to key screens; the rest covered by component-level pseudo-localisation |
