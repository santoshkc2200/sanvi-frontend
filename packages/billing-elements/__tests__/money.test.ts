import { describe, expect, it } from 'vitest'
import {
  formatMinor,
  majorToMinor,
  majorUnitStep,
  minorToMajor,
  minorUnitExponent,
} from '../src/money'

describe('minorUnitExponent', () => {
  it('is 2 for a normal currency (USD)', () => {
    expect(minorUnitExponent('USD')).toBe(2)
  })

  it('is 0 for a zero-decimal currency (JPY)', () => {
    expect(minorUnitExponent('JPY')).toBe(0)
  })

  it('is case- and whitespace-insensitive', () => {
    expect(minorUnitExponent(' jpy ')).toBe(0)
    expect(minorUnitExponent('usd')).toBe(2)
  })
})

describe('majorToMinor / minorToMajor round trips', () => {
  it('round-trips a USD amount through 100x, not through a fixed assumption', () => {
    expect(majorToMinor(19.99, 'USD')).toBe(1999)
    expect(minorToMajor(1999, 'USD')).toBeCloseTo(19.99)
  })

  it('round-trips a JPY amount 1:1 — the bug this module exists to prevent', () => {
    // A naive `Math.round(major * 100)` would store ¥2,000 as 200000.
    expect(majorToMinor(2000, 'JPY')).toBe(2000)
    expect(minorToMajor(2000, 'JPY')).toBe(2000)
  })

  it('rounds fractional major-unit input to the nearest minor unit', () => {
    expect(majorToMinor(19.999, 'USD')).toBe(2000)
  })
})

describe('majorUnitStep', () => {
  it('is 0.01 for USD', () => {
    expect(majorUnitStep('USD')).toBe(0.01)
  })

  it('is 1 for JPY — fractional yen are not a thing', () => {
    expect(majorUnitStep('JPY')).toBe(1)
  })
})

describe('formatMinor', () => {
  it('formats a USD minor amount as currency', () => {
    expect(formatMinor(1999, 'USD')).toContain('19.99')
  })

  it('formats a JPY minor amount without introducing a decimal point', () => {
    const formatted = formatMinor(2000, 'JPY')
    expect(formatted).toContain('2,000')
    expect(formatted).not.toMatch(/2,000\.\d/)
  })

  it('falls back to "<amount> <CODE>" for a malformed currency code Intl rejects', () => {
    // Intl requires a well-formed 3-letter code; 'US' throws a RangeError.
    expect(formatMinor(500, 'US')).toBe('5.00 US')
  })
})
