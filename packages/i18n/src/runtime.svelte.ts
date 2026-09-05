import { BASE_LOCALE, isLocale, LOCALE_COOKIE, normalizeLocaleTag, type Locale } from './config'
import { setPseudoMode } from './pseudo'
import { ensureLocaleLoaded } from './catalogs'

/**
 * The locale runtime.
 *
 * - **Client**: a module-level rune store — safe as a singleton for the same
 *   reason `@sanvi/tenant`'s store is: SPAs are one instance per tab, and in
 *   SSR apps the server side of this module never touches `document`.
 * - **Server**: `@sanvi/i18n/server` registers an
 *   AsyncLocalStorage-backed source via {@link registerLocaleSource} at
 *   import time; {@link currentLocale} then answers per-request inside the
 *   hook's `runWithLocale` scope, so `t`/`fmt` never read a module global
 *   that two concurrent requests could fight over.
 */

const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365

function readCookieLocale(): Locale | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))
  return match ? normalizeLocaleTag(decodeURIComponent(match[1] ?? '')) : null
}

function persistLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return
  // biome-ignore lint/suspicious/noDocumentCookie: same reasoning as @sanvi/tenant's preference cookie — the Cookie Store API isn't universally available, and this is a single non-httpOnly preference value, never session data.
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${COOKIE_MAX_AGE_S}; samesite=lax`
}

function initialClientLocale(): Locale {
  if (typeof document === 'undefined') return BASE_LOCALE
  return readCookieLocale() ?? BASE_LOCALE
}

let clientLocale: Locale = $state(initialClientLocale())

let localeSource: (() => Locale | null) | null = null

/**
 * Registers the server-side per-request locale source. Called only by
 * `@sanvi/i18n/server`'s module init — never from browser code.
 */
export function registerLocaleSource(get: (() => Locale | null) | null): void {
  localeSource = get
}

/** The locale `t`/`fmt` render in right now — reactive on the client. */
export function currentLocale(): Locale {
  return localeSource?.() ?? clientLocale
}

type ChangeListener = (locale: Locale) => void
let changeListeners: ChangeListener[] = []

/** Fires after the store, cookie and `<html lang>` are updated — wire locale-dependent refetches (`@sanvi/query`'s `clearCache()`) here, in the app. */
export function onLocaleChange(listener: ChangeListener): () => void {
  changeListeners = [...changeListeners, listener]
  return () => {
    changeListeners = changeListeners.filter((registered) => registered !== listener)
  }
}

export interface I18nInitOptions {
  /**
   * The resolved locale for this render/boot — the SSR hook's or SPA boot's
   * negotiation result. Must run (in component init, before first render)
   * in SSR apps so hydration renders with the server's locale instead of
   * whatever the cookie says. Takes precedence over the legs below.
   */
  locale?: string | null
  /**
   * SPA boot: the signed-in user's account preference. The device cookie
   * (already seeded into the store) outranks it; `navigator.languages` is
   * the fallback after it.
   */
  sessionLocale?: string | null
  /** SPA boot: `navigator.languages`, consulted when no cookie/session signal exists. */
  acceptLanguages?: readonly string[]
  /** Pseudo-localisation mode — wire to `PUBLIC_I18N_PSEUDO=1` (Vite) / `VITE_I18N_PSEUDO=1`. */
  pseudo?: boolean
}

/**
 * One-time boot wiring. In component init it runs before any child renders,
 * which is what makes SSR hydration agree with the server: the store holds
 * the negotiated locale before the first `t()` call on the client.
 */
export function initI18n(options: I18nInitOptions = {}): void {
  if (options.pseudo !== undefined) setPseudoMode(options.pseudo)
  if (options.locale !== undefined) {
    const locale = normalizeLocaleTag(options.locale)
    if (locale && typeof document !== 'undefined') {
      clientLocale = locale
      document.documentElement.lang = locale
      void ensureLocaleLoaded(locale).then(() => {
        for (const listener of changeListeners) listener(locale)
      })
    }
    return
  }
  // SPA legs: the store already holds the device cookie (or base); a session
  // preference fills the gap, then navigator.languages.
  if (readCookieLocale() !== null) return
  const sessionLocale = normalizeLocaleTag(options.sessionLocale)
  if (sessionLocale) {
    if (typeof document !== 'undefined') {
      clientLocale = sessionLocale
      document.documentElement.lang = sessionLocale
      void ensureLocaleLoaded(sessionLocale).then(() => {
        for (const listener of changeListeners) listener(sessionLocale)
      })
    }
    return
  }
  for (const tag of options.acceptLanguages ?? []) {
    const locale = normalizeLocaleTag(tag)
    if (locale) {
      if (typeof document !== 'undefined') {
        clientLocale = locale
        document.documentElement.lang = locale
        void ensureLocaleLoaded(locale).then(() => {
          for (const listener of changeListeners) listener(locale)
        })
      }
      return
    }
  }
}

/**
 * Switches the locale: updates the store (every `t()`/`fmt()` call site
 * re-renders), persists the choice in the `sanvi_locale` cookie, and keeps
 * `<html lang>` truthful. The promise form is part of the phase-06 API —
 * persistence and locale-dependent refetching are allowed to be async; the
 * refetch itself is the app's job via {@link onLocaleChange}.
 */
export async function setLocale(next: Locale | string): Promise<void> {
  if (!isLocale(next)) {
    throw new TypeError(`setLocale: "${String(next)}" is not a configured locale`)
  }
  await ensureLocaleLoaded(next as Locale)
  if (typeof document === 'undefined') return
  clientLocale = next as Locale
  persistLocaleCookie(next as Locale)
  document.documentElement.lang = next
  for (const listener of changeListeners) listener(next as Locale)
}

/** Svelte-store view of {@link currentLocale} — `export const locale: Readable<Locale>` from the phase-06 API. */
export const locale = {
  subscribe(run: (value: Locale) => void): () => void {
    run(currentLocale())
    return onLocaleChange((next) => run(next))
  },
}

/**
 * Persists an explicit locale choice without switching the runtime — for
 * SSR apps whose switcher is real `<a href>` links (SEO): navigation does
 * the switching, this writes the `sanvi_locale` cookie so the *next* visit
 * to an unprefixed URL canonicalizes back to the visitor's locale.
 */
export function persistLocaleChoice(next: Locale | string): void {
  if (!isLocale(next)) {
    throw new TypeError(`persistLocaleChoice: "${String(next)}" is not a configured locale`)
  }
  persistLocaleCookie(next)
}
