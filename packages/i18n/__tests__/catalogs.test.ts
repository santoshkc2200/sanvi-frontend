import { describe, expect, it } from 'vitest'
import { en, jaCatalog, messages, compiledPattern } from '../src/catalogs'
import { OTHER_LOCALES } from '../tools/check.mjs'

describe('catalogs', () => {
  it('compile-time ja parity holds at runtime: exactly the en key set', () => {
    expect(Object.keys(messages.ja ?? {}).sort()).toEqual(Object.keys(en).sort())
  })

  it('every en value is a non-empty string', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(typeof value, key).toBe('string')
      expect((value as string).trim().length, key).toBeGreaterThan(0)
    }
  })

  it('keys are dot-namespaced', () => {
    for (const key of Object.keys(en)) {
      expect(key).toMatch(/^[a-z0-9]+(\.[A-Za-z0-9_-]+)+$/)
    }
  })

  it('jaCatalog is the typed parity witness (Record<MessageKey, string>)', () => {
    expect(jaCatalog['marketing.home.cta']).toBe('始める')
  })

  it('compiledPattern returns null for unknown keys and parses known ones', () => {
    expect(compiledPattern('en', 'no.such.key')).toBeNull()
    expect(compiledPattern('en', 'marketing.home.cta')?.length).toBeGreaterThan(0)
  })

  it('hasMessage returns true for existing keys and false for unknown keys', async () => {
    const { hasMessage } = await import('../src/translate')
    expect(hasMessage('marketing.home.cta')).toBe(true)
    expect(hasMessage('no.such.key')).toBe(false)
  })

  it('the gate and this package agree on the locale set beyond the base', () => {
    // The .mjs gate hard-codes its locale list; this test fails if the two drift.
    for (const locale of OTHER_LOCALES) {
      expect(Object.keys(messages), `gate locale ${locale} must exist in the runtime`).toContain(
        locale,
      )
    }
  })
})
