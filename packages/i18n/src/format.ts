import { isLocale, LOCALE_CONFIGS } from './config'
import { currentLocale } from './runtime.svelte'

/**
 * `fmt` — native `Intl` formatting bound to the *current* locale (the same
 * resolution `t` uses), so no call site ever passes a locale string. No
 * dependencies: `Intl` already implements the ISO-4217 exponent table
 * (JPY formats with zero decimals), the right calendar (Gregory for en/ja),
 * and kana-aware collation for the locales we ship.
 *
 * Formatters are memoized per locale+options — constructing `Intl` objects
 * is one of the slower things a render loop can do.
 */

export type DateStyle = 'short' | 'medium' | 'long' | 'full'

export interface FormatOptions {
  /** Explicit time zone (IANA name). Defaults to the runtime's zone — SSR callers that need deterministic output (hydration!) pass one, e.g. `'UTC'`. */
  timeZone?: string
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options)
    formatterCache.set(key, formatter)
  }
  return formatter
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function withZone(style: DateStyle, opts?: FormatOptions): Intl.DateTimeFormatOptions {
  const options: Intl.DateTimeFormatOptions = { dateStyle: style }
  if (opts?.timeZone) options.timeZone = opts.timeZone
  return options
}

/** `fmt.date(d, 'medium')` — `en`: "Aug 29, 2026" · `ja`: "2026/08/29". */
export function date(
  value: Date | string,
  style: DateStyle = 'medium',
  opts?: FormatOptions,
): string {
  const d = toDate(value)
  if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value : ''
  return dateTimeFormat(currentLocale(), withZone(style, opts)).format(d)
}

/** Date and time in one — the privacy surfaces' "enough to read a deadline" format. */
export function datetime(
  value: Date | string,
  style: DateStyle = 'medium',
  opts?: FormatOptions,
): string {
  const d = toDate(value)
  if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value : ''
  return dateTimeFormat(currentLocale(), {
    dateStyle: style,
    timeStyle: 'short',
    ...(opts?.timeZone ? { timeZone: opts.timeZone } : {}),
  }).format(d)
}

export function number(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(currentLocale(), options).format(value)
}

function currencyExponent(locale: string, currency: string): number {
  try {
    const resolved = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).resolvedOptions()
    return resolved.maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

/**
 * Minor-unit money, exponent-aware: `fmt.money(1200, 'JPY')` → "￥1,200"
 * (zero decimals — never `￥12.00`), `fmt.money(1200, 'USD')` → "$12.00".
 * The exponent comes from `Intl`'s own ISO-4217 table, which agrees with
 * `@sanvi/billing-elements`' `minorUnitExponent` (asserted in tests) without
 * this package depending on it.
 */
export function money(minor: number, currency: string): string {
  const locale = currentLocale()
  const normalized = currency.trim().toUpperCase()
  const major = minor / 10 ** currencyExponent(locale, normalized)
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: normalized }).format(major)
  } catch {
    return `${major.toFixed(currencyExponent(locale, normalized))} ${normalized}`
  }
}

/**
 * Relative time — "in 3 days" / "3日後". Coarse by design: the unit is the
 * largest one whose magnitude is ≥ 1 (min: seconds).
 */
export function relative(value: Date | string, now: number = Date.now()): string {
  const d = toDate(value)
  if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value : ''
  const locale = currentLocale()
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const seconds = (d.getTime() - now) / 1000
  const table: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: 'year', seconds: 31_536_000 },
    { unit: 'month', seconds: 2_592_000 },
    { unit: 'week', seconds: 604_800 },
    { unit: 'day', seconds: 86_400 },
    { unit: 'hour', seconds: 3_600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
  ]
  for (const { unit, seconds: unitSeconds } of table) {
    if (Math.abs(seconds) >= unitSeconds || unit === 'second') {
      return formatter.format(Math.round(seconds / unitSeconds), unit)
    }
  }
  return formatter.format(Math.round(seconds), 'second')
}

/** "a, b and c" / "a、b 和 c" — locale-correct list conjunction. */
export function list(items: string[]): string {
  return new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(items)
}

export interface PersonName {
  given: string
  family: string
}

export interface NameOptions {
  /**
   * Append the locale's honorific (`ja`: 様) — for salutations and
   * address-the-user surfaces. Never string-concatenated at call sites;
   * name *order* and the honorific are locale concerns.
   */
  honorific?: boolean
}

/** `en`: "Taro Yamada" · `ja`: "山田 太郎" (family first), + "様" with `{ honorific: true }`. */
export function name(person: PersonName, options: NameOptions = {}): string {
  const locale = currentLocale()
  const family = person.family.trim()
  const given = person.given.trim()
  const ordered = locale === 'ja' ? [family, given] : [given, family]
  const base = ordered.filter(Boolean).join(locale === 'ja' ? ' ' : ' ')
  return options.honorific && locale === 'ja' ? `${base}様` : base
}

/** Parts of a postal address as the forms capture them (no street/city assumption per locale). */
export interface AddressParts {
  /** 7-digit JP postal codes arrive here normalized (`1234567`); rendering adds the 〒 and hyphen. */
  postalCode?: string
  /** Prefecture (JP) / state (US). */
  prefecture?: string
  city?: string
  line1?: string
  line2?: string
  region?: string
  country?: string
}

/**
 * Locale-driven address template — `ja`: `〒123-4567 東京都渋谷区…` (postal
 * first, no comma separators), `en`: "1 Main St, Springfield, IL 62704".
 * Empty parts are skipped, so partial data renders gracefully.
 */
export function address(parts: AddressParts): string {
  const locale = currentLocale()
  const present = (value: string | undefined): string => (value ?? '').trim()
  if (locale === 'ja') {
    const postal = present(parts.postalCode)
    const body = [
      present(parts.prefecture),
      present(parts.city),
      present(parts.line1),
      present(parts.line2),
    ]
      .filter(Boolean)
      .join('')
    const head = postal
      ? `〒${postal.length === 7 ? `${postal.slice(0, 3)}-${postal.slice(3)}` : postal} `
      : ''
    return `${head}${body}`.trim()
  }
  const line = [present(parts.line1), present(parts.line2)].filter(Boolean).join(', ')
  const cityLine = [
    [present(parts.city), present(parts.region)].filter(Boolean).join(', '),
    present(parts.postalCode),
  ]
    .filter(Boolean)
    .join(' ')
  return [line, cityLine, present(parts.country)].filter(Boolean).join(', ')
}

/** Kana-aware sorting for the current locale — never byte order, never `localeCompare()`'s default locale. */
export function collator(options?: Intl.CollatorOptions): Intl.Collator {
  return new Intl.Collator(currentLocale(), options)
}

/** `<html dir>` for a locale — all configured locales are LTR today; RTL later is a config entry. */
export function dir(locale?: string): 'ltr' | 'rtl' {
  const resolved = locale !== undefined && isLocale(locale) ? locale : currentLocale()
  return LOCALE_CONFIGS[resolved].dir
}

export const fmt = {
  date,
  datetime,
  number,
  money,
  relative,
  list,
  name,
  address,
  collator,
  dir,
}
