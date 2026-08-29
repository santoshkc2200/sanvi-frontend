import {
  BASE_LOCALE,
  currentLocale,
  normalizeLocaleTag,
  withLocalePrefix,
  type Locale,
} from '@sanvi/i18n'
import { getTenantContext } from '@sanvi/tenant'

/**
 * Prefixed internal links: `localePath('/privacy/choices')` renders as
 * `/ja/privacy/choices` on a Japanese page and `/privacy/choices` on a
 * default-locale (unprefixed) one. The default locale comes from the tenant
 * context the root layout set, the current locale from the i18n runtime
 * (AsyncLocalStorage on the server, the rune store during hydration) — so
 * SSR and client always compute the same href.
 *
 * Two read paths for the tenant default, because `getContext` is only legal
 * during component init:
 * - **render time** (href attributes, `$derived`s): the context read works —
 *   per-request, SSR-safe.
 * - **event handlers** (a consent-banner button calling `goto`, a form
 *   redirecting after submit): context is unavailable there, so the client
 *   falls back to the value {@link setClientDefaultLocale} captured at
 *   layout init — and the server never reaches this path.
 */
let clientDefaultLocale: Locale | null = null

/** Called by the root layout's init (client side only) before children render. */
export function setClientDefaultLocale(locale: Locale | string | null): void {
  if (typeof document === 'undefined') return
  clientDefaultLocale = normalizeLocaleTag(locale) ?? BASE_LOCALE
}

function tenantDefaultLocale(): Locale {
  if (clientDefaultLocale !== null) return clientDefaultLocale
  try {
    return normalizeLocaleTag(getTenantContext()?.default_locale) ?? BASE_LOCALE
  } catch {
    // Outside component init on the server — impossible in practice; the
    // base locale keeps the link functional rather than throwing.
    return BASE_LOCALE
  }
}

export function localePath(path: string): string {
  return withLocalePrefix(path, currentLocale(), tenantDefaultLocale())
}
