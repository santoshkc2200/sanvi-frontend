import { describe, expect, it } from 'vitest'
import { ThemeCache } from '../src/cache'
import type { ResolvedTheme } from '../src/types'

function makeMockTheme(key: string, etag: string): ResolvedTheme {
  return {
    theme_key: key,
    theme_version: '1.0.0',
    theme_api: '^1.0.0',
    capabilities: [],
    tokens: {},
    css_vars: ':root{--test:1;}',
    layouts: {},
    fonts: [],
    theme_assets: { screenshots: [] },
    brand_assets: {},
    revision: 1,
    locale: 'en',
    etag,
  }
}

describe('ThemeCache', () => {
  it('stores a fresh entry on write and returns it via get', () => {
    const cache = new ThemeCache()
    const themeA = makeMockTheme('aurora', '"etag-123"')

    cache.set('tenant-1', themeA)

    expect(cache.has('tenant-1')).toBe(true)
    expect(cache.get('tenant-1')).toEqual(themeA)
    expect(cache.getEtag('tenant-1')).toBe('"etag-123"')
  })

  it('returns stored theme on cache hit with matching ETag', () => {
    const cache = new ThemeCache()
    const themeA = makeMockTheme('aurora', '"etag-abc"')
    cache.set('tenant-1', themeA)

    const hit = cache.getIfMatch('tenant-1', '"etag-abc"')
    expect(hit).toEqual(themeA)
    expect(cache.has('tenant-1')).toBe(true)
  })

  it('invalidates entry and returns undefined on ETag mismatch', () => {
    const cache = new ThemeCache()
    const themeA = makeMockTheme('aurora', '"etag-abc"')
    cache.set('tenant-1', themeA)

    // Backend returned 200 with new ETag or client has newer/different ETag
    const mismatchResult = cache.getIfMatch('tenant-1', '"etag-new-xyz"')

    expect(mismatchResult).toBeUndefined()
    expect(cache.has('tenant-1')).toBe(false)
    expect(cache.get('tenant-1')).toBeUndefined()
  })

  it('explicit invalidation removes cached theme', () => {
    const cache = new ThemeCache()
    const themeA = makeMockTheme('base', '"etag-base"')
    cache.set('host.example.com', themeA)

    expect(cache.invalidate('host.example.com')).toBe(true)
    expect(cache.get('host.example.com')).toBeUndefined()
  })

  it('clears all entries on clear()', () => {
    const cache = new ThemeCache()
    cache.set('tenant-1', makeMockTheme('t1', '"e1"'))
    cache.set('tenant-2', makeMockTheme('t2', '"e2"'))

    expect(cache.size).toBe(2)
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.has('tenant-1')).toBe(false)
  })

  it('evicts oldest entry when maxEntries is reached', () => {
    const cache = new ThemeCache({ maxEntries: 2 })
    cache.set('t1', makeMockTheme('t1', '"e1"'))
    cache.set('t2', makeMockTheme('t2', '"e2"'))
    cache.set('t3', makeMockTheme('t3', '"e3"'))

    expect(cache.size).toBe(2)
    expect(cache.has('t1')).toBe(false)
    expect(cache.has('t2')).toBe(true)
    expect(cache.has('t3')).toBe(true)
  })
})
