import { beginRequest, cacheKey, endRequest, getCacheEntry, setCacheEntry } from './cache'

export interface QueryOptions {
  /** How long a cached result is served without refetching. @default 30_000 */
  staleTime?: number
  /** Cache entries carrying any of these tags are dropped by a mutation's `invalidates`. */
  tags?: string[]
  /** Scopes the cache key so a tenant switch can never serve another tenant's rows. Omit for tenant-independent data (platform-admin). */
  tenantId?: string
}

/**
 * One instance per call site (`const usersQuery = createQuery(...)` in a
 * component's `<script>`), not a singleton — same shape as `Router`.
 * Fetches immediately on construction; call `refetch()` to force a fresh
 * fetch past `staleTime`.
 */
export class Query<T> {
  #fetcher: () => Promise<T>
  #fullKey: string
  #tags: string[]
  #staleTime: number

  #data: T | undefined = $state(undefined)
  #error: unknown = $state(null)
  #loading = $state(false)

  constructor(key: string, fetcher: () => Promise<T>, options: QueryOptions = {}) {
    this.#fetcher = fetcher
    this.#fullKey = cacheKey(options.tenantId, key)
    this.#tags = options.tags ?? []
    this.#staleTime = options.staleTime ?? 30_000

    const cached = getCacheEntry(this.#fullKey)
    if (cached && Date.now() - cached.fetchedAt < this.#staleTime) {
      this.#data = cached.data as T
    } else {
      void this.#run()
    }
  }

  get data(): T | undefined {
    return this.#data
  }

  get error(): unknown {
    return this.#error
  }

  get loading(): boolean {
    return this.#loading
  }

  async refetch(): Promise<void> {
    return this.#run()
  }

  async #run(): Promise<void> {
    this.#loading = true
    this.#error = null
    beginRequest()

    try {
      const result = await this.#fetcher()
      this.#data = result
      setCacheEntry(this.#fullKey, result, this.#tags)
    } catch (error) {
      this.#error = error
    } finally {
      this.#loading = false
      endRequest()
    }
  }
}

export function createQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: QueryOptions,
): Query<T> {
  return new Query(key, fetcher, options)
}
