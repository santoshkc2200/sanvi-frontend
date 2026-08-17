/**
 * Browser-only, in-memory, tag-indexed cache. Never active during SSR
 * (`typeof window === 'undefined'` short-circuits every operation to a
 * no-op) — that's what keeps a tenant's cached data from ever crossing into
 * another tenant's concurrent SSR request; there's simply no server-side
 * cache to leak from. The admin/platform-admin SPAs are the only real
 * consumers of this cache (SvelteKit's `load` already does request-scoped
 * caching for the storefront/marketing).
 */

export interface CacheEntry {
  data: unknown
  fetchedAt: number
  tags: string[]
}

const isBrowser = typeof window !== 'undefined'

const entries = new Map<string, CacheEntry>()
const tagIndex = new Map<string, Set<string>>()
let inFlightCount = 0

/** Tenant id is part of every key by construction — a tenant switch can never serve another tenant's cached rows. */
export function cacheKey(tenantId: string | undefined, key: string): string {
  return `${tenantId ?? 'none'}:${key}`
}

export function getCacheEntry(fullKey: string): CacheEntry | undefined {
  return isBrowser ? entries.get(fullKey) : undefined
}

export function setCacheEntry(fullKey: string, data: unknown, tags: string[]): void {
  if (!isBrowser) return
  entries.set(fullKey, { data, fetchedAt: Date.now(), tags })
  for (const tag of tags) {
    const keysForTag = tagIndex.get(tag) ?? new Set<string>()
    keysForTag.add(fullKey)
    tagIndex.set(tag, keysForTag)
  }
}

/** Drops every cache entry carrying `tag` — call after a mutation that makes those entries stale. */
export function invalidate(tag: string): void {
  const keys = tagIndex.get(tag)
  if (!keys) return
  for (const key of keys) entries.delete(key)
  tagIndex.delete(tag)
}

/** Drops everything — call on tenant switch and on logout, per the phase-01 security requirement that no tenant data survives either. */
export function clearCache(): void {
  entries.clear()
  tagIndex.clear()
}

export function beginRequest(): void {
  inFlightCount += 1
}

export function endRequest(): void {
  inFlightCount = Math.max(0, inFlightCount - 1)
}

export function getInFlightCount(): number {
  return inFlightCount
}

/** For `QueryDevtools` — a snapshot, not a live reference. */
export function listCacheEntries(): { key: string; fetchedAt: number; tags: string[] }[] {
  return [...entries.entries()].map(([key, entry]) => ({
    key,
    fetchedAt: entry.fetchedAt,
    tags: entry.tags,
  }))
}
