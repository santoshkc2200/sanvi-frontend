import { beforeEach, describe, expect, it } from 'vitest'
import { fmt } from '../src/format'
import { setLocale } from '../src/runtime.svelte'

// Deterministic formatting: every test pins the locale explicitly.
describe('fmt', () => {
  beforeEach(async () => {
    await setLocale('en')
  })

  describe('money', () => {
    it('renders JPY with zero decimals — never ¥12.00', async () => {
      await setLocale('en')
      expect(fmt.money(1200, 'JPY')).toBe('¥1,200')
      expect(fmt.money(0, 'JPY')).toBe('¥0')
    })

    it('renders USD with two decimals from minor units', async () => {
      expect(fmt.money(1200, 'USD')).toBe('$12.00')
    })

    it('renders Japanese-style amounts for ja', async () => {
      await setLocale('ja')
      expect(fmt.money(1200, 'JPY')).toBe('￥1,200')
      expect(fmt.money(1200, 'USD')).toBe('$12.00')
    })

    it('degrades to "<amount> <CODE>" for an unknown currency instead of throwing', () => {
      expect(fmt.money(1234, 'NOPE')).toBe('12.34 NOPE')
    })
  })

  describe('date/datetime', () => {
    const instant = '2026-08-15T00:00:00Z'

    it('renders per locale', async () => {
      expect(fmt.date(instant, 'long', { timeZone: 'UTC' })).toBe('August 15, 2026')
      await setLocale('ja')
      expect(fmt.date(instant, 'long', { timeZone: 'UTC' })).toBe('2026年8月15日')
    })

    it('keeps SSR deterministic when passed an explicit time zone', () => {
      expect(fmt.datetime(instant, 'medium', { timeZone: 'UTC' })).toContain('Aug 15, 2026')
    })

    it('passes junk ISO strings through untouched rather than "Invalid Date"', () => {
      expect(fmt.date('not-a-date')).toBe('not-a-date')
      expect(fmt.date('')).toBe('')
    })
  })

  describe('relative', () => {
    it('renders relative time per locale', async () => {
      const now = Date.UTC(2026, 7, 15, 12, 0, 0)
      expect(fmt.relative('2026-08-18T12:00:00Z', now)).toBe('in 3 days')
      await setLocale('ja')
      // ICU inserts a thin space between count and unit in Japanese.
      expect(fmt.relative('2026-08-18T12:00:00Z', now)).toBe('3 日後')
    })
  })

  describe('name', () => {
    it('en is given-first, ja is family-first', async () => {
      expect(fmt.name({ given: 'Taro', family: 'Yamada' })).toBe('Taro Yamada')
      await setLocale('ja')
      expect(fmt.name({ given: '太郎', family: '山田' })).toBe('山田 太郎')
    })

    it('appends the honorific in ja when asked — never concatenated at call sites', async () => {
      await setLocale('ja')
      expect(fmt.name({ given: '太郎', family: '山田' }, { honorific: true })).toBe('山田 太郎様')
      await setLocale('en')
      expect(fmt.name({ given: 'Taro', family: 'Yamada' }, { honorific: true })).toBe('Taro Yamada')
    })
  })

  describe('address', () => {
    const jp = {
      postalCode: '1500001',
      prefecture: '東京都',
      city: '渋谷区',
      line1: '神宮前1-2-3',
      line2: 'サンフラワービル4F',
    }

    it('ja: postal first with 〒 and hyphen, no comma separators', async () => {
      await setLocale('ja')
      expect(fmt.address(jp)).toBe('〒150-0001 東京都渋谷区神宮前1-2-3サンフラワービル4F')
    })

    it('en: street lines, city/region/postal, country', async () => {
      expect(
        fmt.address({ line1: '1 Main St', city: 'Springfield', region: 'IL', postalCode: '62704' }),
      ).toBe('1 Main St, Springfield, IL 62704')
    })

    it('skips missing parts gracefully', async () => {
      await setLocale('ja')
      expect(fmt.address({ postalCode: '1000001', city: '千代田区' })).toBe('〒100-0001 千代田区')
      expect(fmt.address({})).toBe('')
    })
  })

  it('list joins with the locale conjunction', async () => {
    expect(fmt.list(['a', 'b', 'c'])).toBe('a, b, and c')
    await setLocale('ja')
    expect(fmt.list(['a', 'b', 'c'])).toBe('a、b、c')
  })

  it('number formats per locale', async () => {
    expect(fmt.number(12345.678)).toBe('12,345.678')
    await setLocale('ja')
    expect(fmt.number(12345.678)).toBe('12,345.678')
  })

  it("collator threads the current locale (ICU's ja order, not codepoint order)", async () => {
    await setLocale('ja')
    const input = ['コンピュータ', 'ひらがな', 'りんご']
    expect([...input].sort(fmt.collator().compare)).toEqual(
      [...input].sort(new Intl.Collator('ja').compare),
    )
    // And it is not the default-locale collator's result by accident:
    expect(fmt.collator().resolvedOptions().locale.toLowerCase()).toContain('ja')
  })

  it('dir is ltr for the configured locales', async () => {
    expect(fmt.dir()).toBe('ltr')
    expect(fmt.dir('ja')).toBe('ltr')
  })
})
