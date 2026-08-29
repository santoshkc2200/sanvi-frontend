import { describe, expect, it } from 'vitest'
import { parseAcceptLanguage } from '../src/accept-language'

describe('parseAcceptLanguage', () => {
  it('picks the highest-quality match', () => {
    expect(parseAcceptLanguage('fr-FR, ja;q=0.9, en;q=0.8')).toBe('ja')
    expect(parseAcceptLanguage('de;q=1.0, en;q=0.5')).toBe('en')
  })

  it('respects quality values over header order', () => {
    expect(parseAcceptLanguage('en;q=0.3, ja;q=0.9')).toBe('ja')
    // Equal quality keeps header order.
    expect(parseAcceptLanguage('ja;q=0.5, en;q=0.5')).toBe('ja')
  })

  it('canonicalises region-qualified tags', () => {
    expect(parseAcceptLanguage('ja-JP,ja;q=0.9')).toBe('ja')
    expect(parseAcceptLanguage('en-US,en;q=0.9')).toBe('en')
  })

  it('ignores unconfigured languages and wildcards', () => {
    expect(parseAcceptLanguage('de-DE,de;q=0.9')).toBeNull()
    expect(parseAcceptLanguage('*, en;q=0.5')).toBe('en')
    expect(parseAcceptLanguage('*')).toBeNull()
  })

  it('honours the available-locale restriction', () => {
    expect(parseAcceptLanguage('ja, en;q=0.5', ['en'])).toBe('en')
    expect(parseAcceptLanguage('ja', ['en'])).toBeNull()
  })

  it('tolerates junk input', () => {
    expect(parseAcceptLanguage(null)).toBeNull()
    expect(parseAcceptLanguage('')).toBeNull()
    expect(parseAcceptLanguage(',,,')).toBeNull()
    expect(parseAcceptLanguage('en;q=banana')).toBe('en') // bad q → treated as 1.0
  })
})
