import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  collectProblems,
  collectShardProblems,
  collectSurfaceProblems,
  parseSurfaceFile,
} from '../tools/check.mjs'

// Fixture surface modules live under __fixtures__/ as .txt: their whole
// purpose is to contain import-shaped text, which check:boundaries' regex
// scanner would otherwise read as real cross-package imports. Resolved via
// cwd (always this package's root under vitest) because the jsdom transform
// rewrites `new URL(…, import.meta.url)` onto an http origin.
const fixture = (name: string) => readFileSync(resolve('__fixtures__', 'surfaces', name), 'utf8')

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

describe('i18n:check shard hygiene (TASK-032)', () => {
  it('passes when both locales carry the same shards and keys sit in their prefix shard', () => {
    const shards = {
      en: new Map([
        ['common', { 'common.retry': 'Try again' }],
        ['storefront', { 'storefront.home.title': 'Welcome' }],
      ]),
      ja: new Map([
        ['common', { 'common.retry': '再試行' }],
        ['storefront', { 'storefront.home.title': 'ようこそ' }],
      ]),
    }
    expect(collectShardProblems(shards)).toEqual([])
  })

  it('fails when a locale misses a shard the base locale has', () => {
    const shards = {
      en: new Map([['common', { 'common.retry': 'Try again' }]]),
      ja: new Map([['storefront', { 'storefront.home.title': 'ようこそ' }]]),
    }
    const problems = collectShardProblems(shards)
    expect(problems).toContain('ja  —  shard missing: common.json')
    expect(problems).toContain('ja  —  shard not in en: storefront.json')
  })

  it('fails when a key lives in the wrong shard for its prefix', () => {
    const shards = {
      en: new Map([['common', { 'admin.title': 'Misplaced' }]]),
      ja: new Map([['common', { 'admin.title': '配置ミス' }]]),
    }
    expect(collectShardProblems(shards)).toContain(
      'en  admin.title  lives in shard "common" but its prefix names "admin"',
    )
  })

  it('fails when a surface loads a shard for en but not ja (and vice versa)', () => {
    const surfaces = {
      storefront: { en: new Set(['storefront', 'common']), ja: new Set(['storefront']) },
    }
    expect(collectSurfaceProblems(surfaces, ['storefront', 'common'])).toContain(
      'surface storefront  loads en/common.json but not ja/common.json',
    )
  })

  it('fails when the all surface does not cover every shard', () => {
    const surfaces = {
      all: { en: new Set(['common']), ja: new Set(['common']) },
    }
    expect(collectSurfaceProblems(surfaces, ['common', 'storefront'])).toContain(
      'surface all  —  does not cover shard storefront.json',
    )
  })

  it('fails when a shard is registered by no app surface — its keys could never render', () => {
    const surfaces = {
      all: { en: new Set(['common', 'orphan']), ja: new Set(['common', 'orphan']) },
      storefront: { en: new Set(['common']), ja: new Set(['common']) },
    }
    expect(collectSurfaceProblems(surfaces, ['common', 'orphan'])).toContain(
      'surfaces  —  shard orphan.json is registered by no app surface (keys unreachable)',
    )
  })

  it('parseSurfaceFile reads a surface module the way the shard gate does', () => {
    expect(parseSurfaceFile(fixture('marketing.ts.txt'))).toEqual({
      en: new Set(['common', 'errors']),
      ja: new Set(['common', 'errors']),
    })
  })
})
