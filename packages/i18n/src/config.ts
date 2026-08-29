/**
 * The locale registry — the single place a locale is declared.
 *
 * Adding a locale is *a catalog and a config entry, nothing else* (the
 * phase-06 acceptance criterion): add `messages/<code>.json`, add the code to
 * the {@link Locale} union below and an entry to {@link LOCALE_CONFIGS}. The
 * type checker then drives the rest — `messages/<code>.json` is checked
 * against the English key set in `catalogs.ts`, so a missing key is a compile
 * error, and every locale-aware surface (routing prefixes, `<html lang>`,
 * negotiation, formatters, the switcher) derives from `LOCALE_CONFIGS` rather
 * than from hand-written `if` branches.
 *
 * Shipped scope is English and Japanese; the shape of everything here was
 * exercised against a third locale in the test-suite before `ja` ever
 * existed (see `__tests__/config.test.ts`).
 */

export const BASE_LOCALE = 'en'

export type Locale = 'en' | 'ja'

export interface LocaleConfig {
  /** BCP-47 tag used in URL prefixes, `<html lang>`, `Intl` calls and `Accept-Language`. */
  readonly code: Locale
  /** The language's name in itself — what the switcher shows. */
  readonly nativeName: string
  readonly englishName: string
  /** `dir` for `<html dir>`; logical CSS properties are used throughout, so an RTL locale later is a config entry too. */
  readonly dir: 'ltr' | 'rtl'
  /** `og:locale` wants an underscore region tag (`ja_JP`), unlike BCP-47. */
  readonly ogLocale: string
}

export const LOCALE_CONFIGS: Record<Locale, LocaleConfig> = {
  en: {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    dir: 'ltr',
    ogLocale: 'en_US',
  },
  ja: {
    code: 'ja',
    nativeName: '日本語',
    englishName: 'Japanese',
    dir: 'ltr',
    ogLocale: 'ja_JP',
  },
}

/** Every configured locale — derivation order is the switcher's display order. */
export const LOCALES: readonly Locale[] = Object.keys(LOCALE_CONFIGS) as Locale[]

/** Cookie persisting an explicit locale choice (device-level, like `sanvi_tenant`). */
export const LOCALE_COOKIE = 'sanvi_locale'

/** Switcher/options data for the configured locales, in display order. */
export function localeOptions(): { code: Locale; label: string; englishName: string }[] {
  return LOCALES.map((code) => ({
    code,
    label: LOCALE_CONFIGS[code].nativeName,
    englishName: LOCALE_CONFIGS[code].englishName,
  }))
}

/**
 * True when `value` is exactly a configured locale code. Locale values come
 * from user input (URL prefix, cookie, `Accept-Language`, API fields) and are
 * allow-listed here before they may reach a URL, an `Intl` call, or a
 * catalog lookup — never trusted by shape alone.
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && Object.hasOwn(LOCALE_CONFIGS, value)
}

/**
 * Canonicalises a BCP-47 tag to a configured locale: `ja-JP` → `ja`,
 * `EN-us` → `en`. Returns `null` for tags that don't map onto a configured
 * locale (rather than the base locale) so callers can distinguish "no
 * signal" from "explicit English" — negotiation needs that difference.
 */
export function normalizeLocaleTag(value: string | null | undefined): Locale | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  // `Intl.Locale` parses the full BCP-47 grammar (language, script, region,
  // extensions); fall back to a prefix split for runtimes that reject a tag.
  let language = trimmed.toLowerCase()
  try {
    language = new Intl.Locale(trimmed).language.toLowerCase()
  } catch {
    const base = language.split(/[-_]/)[0]
    if (base) language = base
  }
  return isLocale(language) ? language : null
}
