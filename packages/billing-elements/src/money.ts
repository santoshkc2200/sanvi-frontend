/**
 * Currency-aware minor-unit arithmetic and formatting.
 *
 * Every price in this system crosses the wire as an integer count of the
 * currency's *minor* units, matching how the backend stores it
 * (kernel.Money) and how Stripe expects amounts. The catch is that "minor
 * unit" is not always 1/100: JPY, KRW and friends have no subunit at all,
 * so ¥2,000 is the integer 2000, not 200000.
 *
 * Assuming a fixed ÷100 is exactly the bug this module exists to prevent.
 * The plan editor used to write `Math.round(major * 100)` for every
 * currency, so a ¥2,000 plan band was stored as 200000. Display divided by
 * 100 again and so looked right, which is what let it survive - but every
 * amount actually *sent* to Stripe (a fixed-amount coupon's amount_off, a
 * course's unit_amount) was 100x too large.
 *
 * Lives in @sanvi/billing-elements because every app that touches Stripe already depends on it
 * for card collection, and money formatting has the same "must agree
 * everywhere or the numbers quietly disagree" property.
 */

/**
 * ISO 4217 currencies with no minor unit, per Stripe's zero-decimal list.
 * A currency absent from this set is assumed to have 2 decimal places,
 * which is correct for every currency this product bills in today.
 * (Three-decimal currencies - BHD, KWD, TND - are deliberately not modeled:
 * Stripe requires their amounts to be a multiple of 10 in a 1/1000 unit,
 * which needs handling beyond an exponent and is better added when a real
 * requirement for one exists than guessed at now.)
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
])

/** Decimal places between a currency's major and minor unit: 0 for JPY, 2 for USD. */
export function minorUnitExponent(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.trim().toUpperCase()) ? 0 : 2
}

/** The multiplier between one major unit and its minor units: 1 for JPY, 100 for USD. */
function minorUnitFactor(currency: string): number {
  return 10 ** minorUnitExponent(currency)
}

/**
 * Converts a human-entered major-unit amount (2000, or 19.99) to the
 * integer minor-unit amount the API and Stripe expect.
 */
export function majorToMinor(major: number, currency: string): number {
  return Math.round(major * minorUnitFactor(currency))
}

/** The inverse of {@link majorToMinor}, for seeding an edit form from stored data. */
export function minorToMajor(minor: number, currency: string): number {
  return minor / minorUnitFactor(currency)
}

/**
 * Formats a minor-unit amount for display in the user's locale. Falls back
 * to "<amount> <CODE>" when the currency code isn't one Intl recognizes,
 * rather than throwing - a plan with a mistyped currency should render
 * imperfectly, not blank the page.
 */
export function formatMinor(minor: number, currency: string): string {
  const major = minorToMajor(minor, currency)
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(major)
  } catch {
    return `${major.toFixed(minorUnitExponent(currency))} ${currency}`
  }
}

/**
 * The smallest amount a user can enter in this currency - the `step` for a
 * price input. 1 for JPY (fractional yen aren't a thing), 0.01 otherwise.
 */
export function majorUnitStep(currency: string): number {
  return 1 / minorUnitFactor(currency)
}
