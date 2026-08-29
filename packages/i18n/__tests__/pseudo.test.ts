import { describe, expect, it } from 'vitest'
import { nfkc, normalizeEmail, normalizeSlug, normalizeTel } from '../src/normalize'
import { isPseudoMode, pseudoize, setPseudoMode } from '../src/pseudo'

describe('pseudo-localisation', () => {
  it('is off by default', () => {
    expect(isPseudoMode()).toBe(false)
  })

  it('accents, expands, and brackets — expansion is what the layout tests rely on', () => {
    const original = 'Get started'
    const pseudo = pseudoize(original)
    expect(pseudo.startsWith('[')).toBe(true)
    expect(pseudo.endsWith(']')).toBe(true)
    expect(pseudo).not.toContain('Get started')
    // ~30-40 % expansion target: doubled vowels + accented multibyte chars.
    expect(pseudo.length).toBeGreaterThanOrEqual(original.length + 4)
  })

  it('preserves non-Latin text (CJK passes through; ja copy is not expanded by accents)', () => {
    expect(pseudoize('日本語のコピー')).toBe('[日本語のコピー]')
  })

  it('round-trips deterministically', () => {
    expect(pseudoize('Hello')).toBe(pseudoize('Hello'))
  })

  it('setPseudoMode flips the module flag translate reads', () => {
    setPseudoMode(true)
    expect(isPseudoMode()).toBe(true)
    setPseudoMode(false)
    expect(isPseudoMode()).toBe(false)
  })
})

describe('input normalisation (NFKC)', () => {
  it('full-width → half-width for emails — IMEs emit ｕｓｅｒ＠ｅｘａｍｐｌｅ．ｃｏｍ', () => {
    expect(normalizeEmail('ｕｓｅｒ＠ＥＸＡＭＰＬＥ．ｃｏｍ')).toBe('user@example.com')
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
  })

  it('full-width digits for phone numbers, separators stripped', () => {
    expect(normalizeTel('０３-１２３４－５６７８')).toBe('0312345678')
    expect(normalizeTel('+81 (03) 1234-5678')).toBe('+810312345678')
  })

  it('slugs: NFKC, trim, lowercase', () => {
    expect(normalizeSlug('  ｍｙ－Ｓｌｕｇ ')).toBe('my-slug')
  })

  it('nfkc is the general escape hatch', () => {
    expect(nfkc('①２３')).toBe('123')
  })
})
