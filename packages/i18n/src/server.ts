import { AsyncLocalStorage } from 'node:async_hooks'
import { parseAcceptLanguage } from './accept-language'
import { BASE_LOCALE, normalizeLocaleTag, LOCALES, type Locale } from './config'
import { parseLocalePrefix } from './routing'
import { registerLocaleSource } from './runtime.svelte'

/**
 * **Server-only** entry point (`@sanvi/i18n/server`) — imported by SSR
 * request hooks, never by browser code (`node:async_hooks` has no business
 * in a bundle).
 *
 * SSR must never keep per-request state in a module global: two concurrent
 * requests would fight over it. The AsyncLocalStorage here is the
 * per-request scope — `runWithLocale(locale, () => resolve(event))` makes
 * {@link currentLocale} (and therefore `t`/`fmt`) answer correctly anywhere
 * inside that request's render, including async boundaries Svelte context
 * can't reach (load functions, `transformPageChunk`).
 */
const requestLocale = new AsyncLocalStorage<Locale>()

registerLocaleSource(() => requestLocale.getStore() ?? null)

/** Runs `fn` with `locale` as the request's rendering locale. */
export function runWithLocale<T>(locale: Locale, fn: () => T): T {
  return requestLocale.run(locale, fn)
}

export type LocaleDetectionSource =
  | 'url'
  | 'cookie'
  | 'session'
  | 'tenant'
  | 'accept-language'
  | 'base'

export interface ResolvedRequestLocale {
  locale: Locale
  source: LocaleDetectionSource
}

export interface ResolveRequestLocaleInput {
  pathname: string
  /** Explicit device choice persisted by the locale switcher. */
  cookieLocale?: string | null
  /** The signed-in user's account preference (`MeView.locale`). */
  sessionLocale?: string | null
  /** The tenant's `default_locale` from `TenantContext`. */
  tenantDefaultLocale?: string | null
  /** Raw `Accept-Language` header. */
  acceptLanguage?: string | null
  /** Locales this deployment may serve — defaults to the configured set. */
  available?: readonly Locale[]
}

/**
 * The detection chain, mirroring the backend's negotiation order exactly so
 * client and server never disagree (`docs/phase-06-i18n-l10n/
 * implementation-plan.md`):
 *
 * 1. `/{locale}` URL prefix — the explicit, canonical, shareable signal
 * 2. device cookie (`sanvi_locale`, set by the switcher)
 * 3. account preference (session)
 * 4. tenant default (`TenantContext.default_locale`)
 * 5. `Accept-Language`
 * 6. base locale (`en`)
 *
 * The plan's "user preference" leg is split into device (cookie) and
 * account (session) because a device-local switch must win on that device
 * without writing to the account. Every value is validated against the
 * configured locale set before use — locale is user input.
 */
export function resolveRequestLocale(input: ResolveRequestLocaleInput): ResolvedRequestLocale {
  const available = input.available ?? LOCALES
  const inSet = (locale: Locale): boolean => available.includes(locale)

  const prefixed = parseLocalePrefix(input.pathname, available)
  if (prefixed) return { locale: prefixed.locale, source: 'url' }

  const cookie = normalizeLocaleTag(input.cookieLocale)
  if (cookie && inSet(cookie)) return { locale: cookie, source: 'cookie' }

  const session = normalizeLocaleTag(input.sessionLocale)
  if (session && inSet(session)) return { locale: session, source: 'session' }

  const tenantDefault = normalizeLocaleTag(input.tenantDefaultLocale)
  if (tenantDefault && inSet(tenantDefault)) return { locale: tenantDefault, source: 'tenant' }

  const accept = parseAcceptLanguage(input.acceptLanguage, available)
  if (accept) return { locale: accept, source: 'accept-language' }

  const base = normalizeLocaleTag(BASE_LOCALE)
  if (base && inSet(base)) return { locale: base, source: 'base' }
  return { locale: LOCALES[0] ?? BASE_LOCALE, source: 'base' }
}
