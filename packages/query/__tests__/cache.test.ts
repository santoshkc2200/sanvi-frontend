import { beforeEach, describe, expect, it } from 'vitest'
import {
  beginRequest,
  cacheKey,
  clearCache,
  endRequest,
  getCacheEntry,
  getInFlightCount,
  invalidate,
  listCacheEntries,
  setCacheEntry,
} from '../src/cache'

beforeEach(() => {
  clearCache()
})

describe('cacheKey', () => {
  it('scopes the key by tenant so two tenants never collide', () => {
    expect(cacheKey('acme', 'members')).not.toBe(cacheKey('globex', 'members'))
  })

  it('falls back to a stable placeholder for tenant-independent data', () => {
    expect(cacheKey(undefined, 'operators')).toBe('none:operators')
  })
})

describe('cache read/write', () => {
  it('round-trips a value written with setCacheEntry', () => {
    const key = cacheKey('acme', 'members')
    setCacheEntry(key, [{ id: 1 }], [])
    expect(getCacheEntry(key)?.data).toEqual([{ id: 1 }])
  })

  it('never serves one tenant’s entry under another tenant’s key', () => {
    setCacheEntry(cacheKey('acme', 'members'), ['acme-row'], [])
    setCacheEntry(cacheKey('globex', 'members'), ['globex-row'], [])

    expect(getCacheEntry(cacheKey('acme', 'members'))?.data).toEqual(['acme-row'])
    expect(getCacheEntry(cacheKey('globex', 'members'))?.data).toEqual(['globex-row'])
  })

  it('invalidate(tag) drops only entries carrying that tag', () => {
    setCacheEntry(cacheKey('acme', 'members'), 'a', ['members'])
    setCacheEntry(cacheKey('acme', 'billing'), 'b', ['billing'])

    invalidate('members')

    expect(getCacheEntry(cacheKey('acme', 'members'))).toBeUndefined()
    expect(getCacheEntry(cacheKey('acme', 'billing'))?.data).toBe('b')
  })

  it('clearCache() drops every entry regardless of tenant or tag', () => {
    setCacheEntry(cacheKey('acme', 'members'), 'a', ['members'])
    setCacheEntry(cacheKey('globex', 'members'), 'b', ['members'])

    clearCache()

    expect(listCacheEntries()).toHaveLength(0)
  })
})

describe('in-flight tracking', () => {
  it('tracks concurrent requests and never goes negative', () => {
    expect(getInFlightCount()).toBe(0)
    beginRequest()
    beginRequest()
    expect(getInFlightCount()).toBe(2)
    endRequest()
    expect(getInFlightCount()).toBe(1)
    endRequest()
    endRequest() // one extra end() — must clamp at 0, not go negative
    expect(getInFlightCount()).toBe(0)
  })
})

describe('listCacheEntries', () => {
  it('returns a snapshot with key, fetchedAt, and tags', () => {
    setCacheEntry(cacheKey('acme', 'members'), 'a', ['members', 'roster'])
    const [entry] = listCacheEntries()
    expect(entry?.key).toBe('acme:members')
    expect(entry?.tags).toEqual(['members', 'roster'])
    expect(typeof entry?.fetchedAt).toBe('number')
  })
})
