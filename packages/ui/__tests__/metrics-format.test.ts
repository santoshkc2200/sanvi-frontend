import { describe, expect, it } from 'vitest'
import { formatAdCurrency, formatRatio, minorUnitDigits, NO_VALUE } from '../src/format/metrics'

describe('minorUnitDigits — the zero-decimal guard', () => {
  it('gives JPY zero digits and USD two', () => {
    expect(minorUnitDigits('JPY')).toBe(0)
    expect(minorUnitDigits('USD')).toBe(2)
  })

  it('is case- and whitespace-tolerant', () => {
    expect(minorUnitDigits(' jpy ')).toBe(0)
    expect(minorUnitDigits('usd')).toBe(2)
  })

  it('treats every other zero-decimal currency as such and falls back to 2 for unknown codes', () => {
    expect(minorUnitDigits('KRW')).toBe(0)
    expect(minorUnitDigits('XXX_NOT_A_CODE')).toBe(2)
  })
})

describe('formatAdCurrency — ad-account-currency display', () => {
  it('renders JPY with no decimals: ¥2,000, never ¥2,000.00', () => {
    expect(formatAdCurrency(2000, 'JPY', 'en')).toBe('¥2,000')
    expect(formatAdCurrency(2000, 'JPY', 'ja')).toBe('￥2,000')
  })

  it('renders USD with two decimals', () => {
    expect(formatAdCurrency(1999, 'USD', 'en')).toBe('$19.99')
    expect(formatAdCurrency(0, 'USD', 'en')).toBe('$0.00')
  })

  it('does not convert currencies — the ad account currency is shown natively', () => {
    // Same minor amount, different currencies: only the exponent changes.
    expect(formatAdCurrency(2000, 'JPY', 'en')).toBe('¥2,000')
    expect(formatAdCurrency(2000, 'USD', 'en')).toBe('$20.00')
  })

  it('falls back to "<major> <CODE>" for a code Intl does not know', () => {
    expect(formatAdCurrency(2000, 'XYZ_NOT_REAL', 'en')).toBe('20.00 XYZ_NOT_REAL')
  })
})

describe('formatRatio — ROAS/CPA with the no-division-by-zero guard', () => {
  it('computes a positive ratio with two decimals', () => {
    expect(formatRatio(1000, 400, 'en')).toBe('2.50')
    expect(formatRatio(352.5, 100, 'en')).toBe('3.53')
  })

  it('renders — for zero spend, zero revenue, and both zero', () => {
    expect(formatRatio(0, 400, 'en')).toBe(NO_VALUE) // zero revenue
    expect(formatRatio(1000, 0, 'en')).toBe(NO_VALUE) // zero spend → no ∞
    expect(formatRatio(0, 0, 'en')).toBe(NO_VALUE) // both zero → no NaN
  })

  it('renders — for the backend’s null-on-zero-spend and any non-finite input', () => {
    expect(formatRatio(null, 400, 'en')).toBe(NO_VALUE)
    expect(formatRatio(100, null, 'en')).toBe(NO_VALUE)
    expect(formatRatio(null, null, 'en')).toBe(NO_VALUE)
    expect(formatRatio(Number.NaN, 400, 'en')).toBe(NO_VALUE)
    expect(formatRatio(100, Number.POSITIVE_INFINITY, 'en')).toBe(NO_VALUE)
  })

  it('renders — for negative inputs rather than a negative ratio', () => {
    expect(formatRatio(-100, 400, 'en')).toBe(NO_VALUE)
    expect(formatRatio(100, -400, 'en')).toBe(NO_VALUE)
  })

  it('honors the decimals option and locale digit shaping', () => {
    expect(formatRatio(1000, 300, 'en', { decimals: 1 })).toBe('3.3')
    expect(formatRatio(1234567, 1000, 'en')).toBe('1,234.57')
    expect(formatRatio(1234567, 1000, 'ja')).toBe('1,234.57')
  })
})
