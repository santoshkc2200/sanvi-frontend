import { describe, expect, it } from 'vitest'
import {
  BASE_LOCALE,
  isLocale,
  LOCALES,
  LOCALE_CONFIGS,
  localeOptions,
  normalizeLocaleTag,
} from '../src/config'

describe('locale registry', () => {
  it('ships en and ja, with the base locale first', () => {
    expect(LOCALES).toEqual(['en', 'ja'])
    expect(BASE_LOCALE).toBe('en')
  })

  it('every config entry carries the fields the switcher/SEO need', () => {
    for (const locale of LOCALES) {
      const config = LOCALE_CONFIGS[locale]
      expect(config.code).toBe(locale)
      expect(config.nativeName.length).toBeGreaterThan(0)
      expect(config.englishName.length).toBeGreaterThan(0)
      expect(config.dir).toBe('ltr')
      expect(config.ogLocale).toMatch(/^[a-z]{2}_[A-Z]{2}$/)
    }
    expect(LOCALE_CONFIGS.ja?.nativeName).toBe('日本語')
  })

  describe('isLocale', () => {
    it('accepts exactly the configured codes', () => {
      expect(isLocale('en')).toBe(true)
      expect(isLocale('ja')).toBe(true)
    })

    it('rejects anything else — locale is user input, allow-listed by shape and value', () => {
      for (const bad of [
        '',
        'EN',
        'ja-JP',
        'de',
        'en-US;',
        '..',
        null,
        undefined,
        42,
        {},
        './etc',
      ]) {
        expect(isLocale(bad), String(bad)).toBe(false)
      }
    })
  })

  describe('normalizeLocaleTag', () => {
    it('canonicalises BCP-47 tags onto configured locales', () => {
      expect(normalizeLocaleTag('ja-JP')).toBe('ja')
      expect(normalizeLocaleTag('ja-JP')).toBe('ja')
      expect(normalizeLocaleTag('EN-us')).toBe('en')
      expect(normalizeLocaleTag('en-GB')).toBe('en')
      expect(normalizeLocaleTag(' ja ')).toBe('ja')
    })

    it('returns null (not the base locale) for unconfigured tags — negotiation distinguishes "no signal" from "explicit en"', () => {
      expect(normalizeLocaleTag('de-DE')).toBeNull()
      expect(normalizeLocaleTag('fr')).toBeNull()
      expect(normalizeLocaleTag('')).toBeNull()
      expect(normalizeLocaleTag(null)).toBeNull()
      expect(normalizeLocaleTag(undefined)).toBeNull()
      expect(normalizeLocaleTag('&&&')).toBeNull()
    })
  })

  it('localeOptions derives switcher data from the registry', () => {
    expect(localeOptions()).toEqual([
      { code: 'en', label: 'English', englishName: 'English' },
      { code: 'ja', label: '日本語', englishName: 'Japanese' },
    ])
  })
})
