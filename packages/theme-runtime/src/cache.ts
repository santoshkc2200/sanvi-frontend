import type { ResolvedTheme } from './types'

export interface ThemeCacheEntry {
  theme: ResolvedTheme
  etag: string
  cachedAt: number
}

export interface ThemeCacheOptions {
  maxEntries?: number
  ttlMs?: number
}

/**
 * Cache keyed by tenant/host that stores the last resolved theme + ETag.
 * Supports ETag validation (hit on match, invalidation on mismatch).
 */
export class ThemeCache {
  private cache = new Map<string, ThemeCacheEntry>()
  private maxEntries: number
  private ttlMs?: number

  constructor(options: ThemeCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 500
    this.ttlMs = options.ttlMs
  }

  get(key: string): ResolvedTheme | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (this.ttlMs && Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(key)
      return undefined
    }

    return entry.theme
  }

  getEntry(key: string): ThemeCacheEntry | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (this.ttlMs && Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(key)
      return undefined
    }

    return entry
  }

  getEtag(key: string): string | undefined {
    return this.getEntry(key)?.etag
  }

  set(key: string, theme: ResolvedTheme): void {
    if (!key || !theme) return

    // Evict oldest if capacity exceeded
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      theme,
      etag: theme.etag,
      cachedAt: Date.now(),
    })
  }

  /**
   * Returns cached theme if incoming etag matches the cached entry's etag.
   * If etag does NOT match, invalidates the entry and returns undefined.
   */
  getIfMatch(key: string, incomingEtag: string): ResolvedTheme | undefined {
    const entry = this.getEntry(key)
    if (!entry) return undefined

    if (entry.etag === incomingEtag) {
      return entry.theme
    }

    // ETag mismatch invalidates cache
    this.invalidate(key)
    return undefined
  }

  invalidate(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  get size(): number {
    return this.cache.size
  }
}

export const themeCache = new ThemeCache()

export function getCachedTheme(key: string): ResolvedTheme | undefined {
  return themeCache.get(key)
}

export function setCachedTheme(key: string, theme: ResolvedTheme): void {
  themeCache.set(key, theme)
}

export function invalidateThemeCache(key: string): boolean {
  return themeCache.invalidate(key)
}

export function clearThemeCache(): void {
  themeCache.clear()
}
