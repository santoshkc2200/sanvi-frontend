/**
 * Advertising metric formatting — money in the ad account's currency and
 * performance ratios (ROAS, CPA).
 *
 * These live in `@sanvi/ui`, not in the dashboard route, because every
 * advertising screen from the campaign list (TASK-012) onward renders the
 * same numbers and a per-screen `toFixed` is exactly how JPY grows decimals
 * and a zero-spend ROAS renders as `∞`. Money crosses the wire as integer
 * minor units plus the ad account's ISO-4217 currency (the contract's
 * `MoneyView`: ¥2,000 is `2000` / `JPY`), so "minor unit" is not always
 * 1/100 — the zero-decimal guard below is what keeps ¥2,000 from rendering
 * as ¥20.00 or ¥2,000.00.
 *
 * Dependency-free by design: `@sanvi/ui` imports no data layer, so the
 * decimal places come from `Intl`'s own ISO-4217 table rather than from
 * `@sanvi/billing-elements` (the two agree — that is asserted over there).
 */

/**
 * The stand-in for a metric that cannot be computed: ROAS at zero spend,
 * CPA at zero conversions, or the backend's explicit `null` on the same
 * conditions. An em dash — never `∞`, `NaN`, or a confident-looking `0`.
 */
export const NO_VALUE = '—'

/**
 * Decimal places between a currency's major and minor unit, from `Intl`'s
 * ISO-4217 table: 0 for JPY/KRW and friends, 2 for USD and everything else
 * this product bills in. Falls back to 2 for an unrecognized code rather
 * than throwing — a mistyped currency renders imperfectly, not blank.
 */
export function minorUnitDigits(currency: string, locale?: string): number {
  try {
    const resolved = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.trim().toUpperCase(),
    }).resolvedOptions()
    return resolved.maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

/**
 * Formats a `MoneyView` amount for display in the *ad account's* currency —
 * `formatAdCurrency(2000, 'JPY')` → "¥2,000" (no decimals),
 * `formatAdCurrency(1999, 'USD')` → "$19.99". Ad-account currency is shown
 * natively; converting to the tenant's currency is a separate, explicit
 * display concern (with the FX date), never something this formatter does
 * silently.
 */
export function formatAdCurrency(amountMinor: number, currency: string, locale?: string): string {
  const normalized = currency.trim().toUpperCase()
  const digits = minorUnitDigits(normalized, locale)
  const major = amountMinor / 10 ** digits
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: normalized }).format(major)
  } catch {
    return `${major.toFixed(digits)} ${normalized}`
  }
}

export interface RatioFormatOptions {
  /** Fraction digits of a computable ratio. ROAS reads fine at two: `3.50`. @default 2 */
  decimals?: number
}

/**
 * Divides two advertising metrics — ROAS (revenue ÷ spend), CPA (spend ÷
 * conversions) — rendering {@link NO_VALUE} instead of a lie when either
 * side is zero or unmeasured (`null` from the backend, `NaN` from a
 * upstream computation): no division by zero, no `∞`, ever. Zero *revenue*
 * with nonzero spend is also `—` rather than `0.00`: an unmeasured return
 * and a measured loss are different conversations, and early-day data often
 * cannot tell them apart yet.
 */
export function formatRatio(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  locale?: string,
  options?: RatioFormatOptions,
): string {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    numerator <= 0 ||
    denominator <= 0
  ) {
    return NO_VALUE
  }
  const decimals = options?.decimals ?? 2
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numerator / denominator)
}
