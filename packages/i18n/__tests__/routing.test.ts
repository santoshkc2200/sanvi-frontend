import { describe, expect, it } from 'vitest'
import {
  parseLocalePrefix,
  stripLocalePrefix,
  withLocalePrefix,
  localeHref,
  localeAlternates,
} from '../src/routing'

describe('locale path prefixes', () => {
  describe('parseLocalePrefix', () => {
    it('reads a configured locale prefix and the rest', () => {
      expect(parseLocalePrefix('/ja/privacy')).toEqual({ locale: 'ja', rest: '/privacy' })
      expect(parseLocalePrefix('/en')).toEqual({ locale: 'en', rest: '/' })
      expect(parseLocalePrefix('/ja/')).toEqual({ locale: 'ja', rest: '/' })
      expect(parseLocalePrefix('/ja-JP/privacy')).toEqual({ locale: 'ja', rest: '/privacy' })
    })

    it('returns null for non-locale first segments — real routes never collide', () => {
      expect(parseLocalePrefix('/privacy/choices')).toBeNull()
      expect(parseLocalePrefix('/login')).toBeNull()
      expect(parseLocalePrefix('/')).toBeNull()
      expect(parseLocalePrefix('/xy/privacy')).toBeNull() // not a configured locale
      expect(parseLocalePrefix('/javadir/x')).toBeNull() // 2-letter prefix must match a locale exactly
      expect(parseLocalePrefix('')).toBeNull()
    })

    it('honours the available-locale restriction', () => {
      expect(parseLocalePrefix('/ja/privacy', ['en'])).toBeNull()
      expect(parseLocalePrefix('/en/privacy', ['en'])).toEqual({ locale: 'en', rest: '/privacy' })
    })
  })

  it('stripLocalePrefix passes unprefixed paths through unchanged', () => {
    expect(stripLocalePrefix('/ja/privacy?flow=1'.split('?')[0])).toBe('/privacy')
    expect(stripLocalePrefix('/privacy')).toBe('/privacy')
    expect(stripLocalePrefix('/')).toBe('/')
    expect(stripLocalePrefix('/ja')).toBe('/')
  })

  describe('withLocalePrefix', () => {
    it('prefixes non-default locales', () => {
      expect(withLocalePrefix('/privacy', 'ja', 'en')).toBe('/ja/privacy')
      expect(withLocalePrefix('/', 'ja', 'en')).toBe('/ja')
    })

    it('serves the default locale unprefixed — the canonical form', () => {
      expect(withLocalePrefix('/privacy', 'en', 'en')).toBe('/privacy')
      expect(withLocalePrefix('/', 'en', 'en')).toBe('/')
    })
  })

  describe('localeHref', () => {
    it('swaps the prefix, preserving path and query — the switcher link', () => {
      expect(localeHref('/privacy/choices?return=/x', 'ja')).toBe('/ja/privacy/choices?return=/x')
      expect(localeHref('/ja/privacy/choices?return=/x', 'en')).toBe('/privacy/choices?return=/x')
      expect(localeHref('/', 'ja')).toBe('/ja')
      expect(localeHref('/ja', 'en')).toBe('/')
    })
  })

  describe('localeAlternates', () => {
    it('builds canonical + per-locale alternates + x-default for an unprefixed (default-locale) page', () => {
      const result = localeAlternates('/privacy', 'en')
      expect(result.canonicalLocale).toBe('en')
      expect(result.canonicalPath).toBe('/privacy')
      expect(result.alternates).toEqual([
        { locale: 'en', href: '/privacy' },
        { locale: 'ja', href: '/ja/privacy' },
        { locale: 'x-default', href: '/privacy' },
      ])
    })

    it('builds them for a prefixed page', () => {
      const result = localeAlternates('/ja/privacy', 'en')
      expect(result.canonicalLocale).toBe('ja')
      expect(result.canonicalPath).toBe('/ja/privacy')
      expect(result.alternates.map((a) => a.href)).toEqual(['/privacy', '/ja/privacy', '/privacy'])
    })
  })
})
