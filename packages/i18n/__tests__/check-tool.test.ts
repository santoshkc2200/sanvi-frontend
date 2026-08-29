import { describe, expect, it } from 'vitest'
import { collectProblems } from '../tools/check.mjs'

// The .mjs gate imports cleanly into vitest — same pattern as @sanvi/lint-gates
// testing its own checkers. The CLI tail (file reading, exit codes) is guarded
// by isMainEntryPoint so importing has no side effects.
describe('i18n:check gate', () => {
  const clean = {
    en: { 'a.b': 'Hello {name}', 'c.d': '{count, plural, one {# item} other {# items}}' },
    ja: { 'a.b': 'こんにちは {name}', 'c.d': '{count, plural, other {# 個}}' },
  }

  it('passes clean catalogs', () => {
    expect(collectProblems(clean)).toEqual([])
  })

  it('fails on missing keys', () => {
    const problems = collectProblems({ en: { 'a.b': 'x', 'c.d': 'y' }, ja: { 'a.b': 'x' } })
    expect(problems).toEqual(['ja  c.d  missing key'])
  })

  it('fails on orphaned keys', () => {
    const problems = collectProblems({ en: { 'a.b': 'x' }, ja: { 'a.b': 'x', 'z.w': 'y' } })
    expect(problems).toEqual(['ja  z.w  orphaned key (not in en)'])
  })

  it('fails on empty or non-string values', () => {
    const problems = collectProblems({ en: { 'a.b': '' }, ja: { 'a.b': 42 as unknown as string } })
    expect(problems).toEqual([
      'en  a.b  value must be a non-empty string',
      'ja  a.b  value must be a non-empty string',
    ])
  })

  it('fails on malformed ICU in either locale', () => {
    const problems = collectProblems({
      en: { 'a.b': '{count, plural, one {#}' },
      ja: { 'a.b': 'ok' },
    })
    expect(problems.some((p) => p.includes('malformed ICU'))).toBe(true)
  })

  it('fails on param drift between locales', () => {
    const problems = collectProblems({
      en: { 'a.b': 'Hello {name}' },
      ja: { 'a.b': 'こんにちは' }, // dropped the param
    })
    expect(problems).toEqual(['ja  a.b  does not use base param "name"'])
  })

  it('counts # inside plural branches as the plural param', () => {
    const problems = collectProblems({
      en: { 'a.b': '{count, plural, one {# item} other {# items}}' },
      ja: { 'a.b': '{count, plural, other {# 個}}' },
    })
    expect(problems).toEqual([])
  })

  it('enforces manifest maxLength per locale', () => {
    const manifest = { 'a.b': { maxLength: 10 } }
    expect(collectProblems({ en: { 'a.b': 'short' }, ja: { 'a.b': 'short' } }, manifest)).toEqual(
      [],
    )
    expect(
      collectProblems({ en: { 'a.b': 'a very long label' }, ja: { 'a.b': '短い' } }, manifest),
    ).toEqual(['en  a.b  exceeds maxLength 10 (17)'])
  })

  it('enforces dot-namespaced keys', () => {
    expect(collectProblems({ en: { bare: 'x' }, ja: { bare: 'x' } })).toContainEqual(
      'en  bare  key must be dot-namespaced (area.component.element)',
    )
  })

  it('accepts select, nested plural-in-select and offset', () => {
    const catalogs = {
      en: {
        'a.b': '{role, select, admin {Admin} other {Member}}',
        'c.d': '{n, plural, offset:1 =1 {Yours} other {Yours and #}}',
      },
      ja: {
        'a.b': '{role, select, admin {管理者} other {メンバー}}',
        'c.d': '{n, plural, offset:1 =1 {あなた} other {あなたと #}}',
      },
    }
    expect(collectProblems(catalogs)).toEqual([])
  })
})
