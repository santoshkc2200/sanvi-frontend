import { parseLocalePrefix as canonicalParse, LOCALES } from '@sanvi/i18n'
import { describe, expect, it } from 'vitest'
import {
  LOCALES as MIRRORED_LOCALES,
  parseLocalePrefix as mirroredParse,
} from '../src/lib/locale-prefix.mjs'

/**
 * `src/lib/locale-prefix.mjs` mirrors `@sanvi/i18n`'s routing for
 * svelte.config.js (which plain Node ESM loads and therefore cannot import
 * the package's TS). This test is the sync guarantee: any change to the
 * canonical routing behavior must be reflected in the mirror, or CI fails.
 */
describe('locale-prefix.mjs stays in sync with @sanvi/i18n/routing', () => {
  it('mirrors the configured locale set', () => {
    expect([...MIRRORED_LOCALES]).toEqual([...LOCALES])
  })

  const CASES: [string, string | null][] = [
    ['/ja/privacy', '/privacy'],
    ['/en', '/'],
    ['/ja/', '/'],
    ['/ja-JP/privacy', '/privacy'],
    ['/privacy', null],
    ['/login', null],
    ['/', null],
    ['/xy/privacy', null],
    ['/javadir/x', null],
    ['', null],
  ]

  for (const [input, expectedRest] of CASES) {
    it(`"${input}" → rest ${expectedRest ?? 'null'}`, () => {
      const canonical = canonicalParse(input)
      const mirrored = mirroredParse(input)
      expect(mirrored === null).toBe(canonical === null)
      expect(mirrored?.locale ?? null).toBe(canonical?.locale ?? null)
      expect(mirrored?.rest ?? null).toBe(expectedRest)
    })
  }
})
