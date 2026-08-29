/**
 * Locale path-prefix helpers — the `/{locale}/…` routing story for the SSR
 * apps (storefront, marketing). Pure string math, no runes and no Node
 * APIs, so `svelte.config.js` can import this subpath at build time for its
 * `reroute` hook (`@sanvi/i18n/routing`) while the same functions answer
 * runtime questions in request hooks and components.
 *
 * The tenant's default locale is served *unprefixed* (the phase-06 SEO
 * decision): `/ja/privacy` renders Japanese, `/privacy` renders the
 * default. `parseLocalePrefix` only recognizes prefixes for configured
 * locales — a path like `/xy/privacy` is never mistaken for a locale
 * prefix, so real routes can't collide with one.
 */
import { BASE_LOCALE, LOCALES, normalizeLocaleTag, type Locale } from './config'

export interface LocalePrefix {
  locale: Locale
  /** Everything after the prefix — `''` for the bare `/{locale}` root. */
  rest: string
}

// Lookahead, not consumption: the segment after the locale keeps its slash.
const PREFIX_SHAPE = /^\/([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?)(?=\/|$)/

/**
 * Reads a locale prefix off a pathname. Returns `null` when the first
 * segment isn't a configured locale — the caller then treats the path as
 * prefix-less (which for unknown two-letter segments means the app's own
 * 404, not a locale).
 */
export function parseLocalePrefix(
  pathname: string,
  available: readonly Locale[] = LOCALES,
): LocalePrefix | null {
  const match = PREFIX_SHAPE.exec(pathname)
  if (!match) return null
  const locale = normalizeLocaleTag(match[1])
  if (!locale || !available.includes(locale)) return null
  return { locale, rest: pathname.slice(match[0].length) || '/' }
}

/** The pathname without its locale prefix — unchanged when there is none. */
export function stripLocalePrefix(pathname: string, available?: readonly Locale[]): string {
  return parseLocalePrefix(pathname, available)?.rest ?? pathname
}

/**
 * Prepends `locale`'s prefix unless it's the default locale — the
 * canonical, unprefixed form. Input is a pathname (leading `/`).
 */
export function withLocalePrefix(path: string, locale: Locale, defaultLocale: Locale): string {
  const suffixed = path.startsWith('/') ? path : `/${path}`
  return locale === defaultLocale ? suffixed : `/${locale}${suffixed === '/' ? '' : suffixed}`
}

/**
 * The same URL as `href` but for `target` locale — first segment swapped in
 * or out, query string preserved. This is the locale switcher's link: the
 * phase-06 plan's "preserves the current path and query".
 */
export function localeHref(href: string, target: Locale, available?: readonly Locale[]): string {
  const [beforeQuery, query] = splitOnce(href, '?')
  const rest = stripLocalePrefix(beforeQuery, available)
  const prefixed = target === BASE_LOCALE ? rest : `/${target}${rest === '/' ? '' : rest}`
  return query ? `${prefixed}?${query}` : prefixed
}

/**
 * Canonical/alternate data for SEO tags on a localized page. The canonical
 * URL carries the page's own locale prefix (or none for the default
 * locale); `alternates` lists every configured locale's equivalent URL plus
 * `x-default`, which points at the unprefixed (default-locale) form.
 */
export function localeAlternates(
  pathname: string,
  defaultLocale: Locale,
  available: readonly Locale[] = LOCALES,
): {
  canonicalLocale: Locale
  canonicalPath: string
  alternates: { locale: string; href: string }[]
} {
  const current = parseLocalePrefix(pathname, available)?.locale ?? defaultLocale
  const rest = stripLocalePrefix(pathname, available)
  const alternates: { locale: string; href: string }[] = available.map((locale) => ({
    locale,
    href: withLocalePrefix(rest, locale, defaultLocale),
  }))
  alternates.push({
    locale: 'x-default',
    href: withLocalePrefix(rest, defaultLocale, defaultLocale),
  })
  return {
    canonicalLocale: current,
    canonicalPath: withLocalePrefix(rest, current, defaultLocale),
    alternates,
  }
}

function splitOnce(value: string, separator: string): [string, string | undefined] {
  const index = value.indexOf(separator)
  return index === -1 ? [value, undefined] : [value.slice(0, index), value.slice(index + 1)]
}
