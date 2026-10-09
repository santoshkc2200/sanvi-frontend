import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { TenantContext } from './types'

export interface TenantResolution {
  status: 'ok' | 'unknown-host'
  tenant: TenantContext | null
  /**
   * Set when this resolution came from the stale half of the
   * stale-while-revalidate window (TASK-023): the answer may be out of date,
   * and the storefront renders a stale-content banner when it is. Absent on
   * a fresh or network-fetched resolution.
   */
  stale?: boolean
}

export class TenantResolutionError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'TenantResolutionError'
    this.status = status
  }
}

export interface FetchTenantContextOptions {
  /** e.g. `https://api.sanvi.app` — no trailing slash. */
  apiOrigin: string
  /** The tenant's storefront host — from the *browser's* request, not the API origin's. */
  host: string
  /** @default 5_000 */
  timeoutMs?: number
}

/**
 * The backend resolves `GET /api/v1/public/tenant-context` strictly from the
 * `Host` header of its own incoming request (`sanvi-backend`'s
 * `public_tenant_context` handler reads `req.headers().get(HOST)` — no query
 * param or alternate header). The storefront SSR process serves every
 * tenant's subdomain from one process, so it must forward the *tenant's*
 * host to a *different* TCP destination (the API origin) — the one thing
 * the WHATWG `fetch` API refuses to do: `Host` is a protected header that
 * both browsers and Node's own `fetch`/undici silently overwrite with the
 * real connection target (verified empirically — a `fetch` call with a
 * `host` header override still arrives at the server with the real host).
 * `node:http`'s `request()` has no such restriction, so this is the one
 * deliberate, server-only, non-`fetch` HTTP call in the workspace. It is
 * exported only from `@sanvi/tenant/server`, never the package's default
 * entry point, so it can never end up in a browser bundle.
 */
export function fetchTenantContext({
  apiOrigin,
  host,
  timeoutMs = 5_000,
}: FetchTenantContextOptions): Promise<TenantResolution> {
  const target = new URL('/api/v1/public/tenant-context', apiOrigin)
  const transport = target.protocol === 'https:' ? httpsRequest : httpRequest

  return new Promise((resolve, reject) => {
    const req = transport(
      target,
      { method: 'GET', headers: { host, accept: 'application/json' }, timeout: timeoutMs },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const status = res.statusCode ?? 0
          const body = Buffer.concat(chunks).toString('utf8')

          if (status === 200) {
            try {
              resolve({ status: 'ok', tenant: JSON.parse(body) as TenantContext })
            } catch {
              reject(new TenantResolutionError(status, 'Malformed tenant-context response body'))
            }
            return
          }
          if (status === 404) {
            resolve({ status: 'unknown-host', tenant: null })
            return
          }
          reject(
            new TenantResolutionError(
              status,
              `Tenant context request failed with status ${status}`,
            ),
          )
        })
      },
    )

    req.on('timeout', () => {
      req.destroy(
        new TenantResolutionError(0, `Tenant context request timed out after ${timeoutMs}ms`),
      )
    })
    req.on('error', (error) => {
      reject(
        error instanceof TenantResolutionError
          ? error
          : new TenantResolutionError(0, error.message),
      )
    })
    req.end()
  })
}

export interface TenantHostCacheOptions {
  /** How long a resolution is served without revalidating. @default 30_000 */
  freshMs?: number
  /** Past `freshMs`, still served immediately while a revalidation fires in the background. @default 300_000 */
  staleMs?: number
}

interface CacheEntry {
  resolution: TenantResolution
  fetchedAt: number
  revalidating: boolean
}

/**
 * Host → tenant-context cache with TTL + stale-while-revalidate, shared
 * across concurrent SSR requests on purpose — it caches *by host*, never by
 * request/subject, so there is nothing per-request to leak between
 * concurrent requests. "Unknown host" results are cached the same way as
 * resolved ones, which is the negative cache: no extra bookkeeping needed.
 */
export class TenantHostCache {
  #entries = new Map<string, CacheEntry>()
  #freshMs: number
  #staleMs: number

  constructor(options: TenantHostCacheOptions = {}) {
    this.#freshMs = options.freshMs ?? 30_000
    this.#staleMs = options.staleMs ?? 5 * 60_000
  }

  async resolve(options: FetchTenantContextOptions): Promise<TenantResolution> {
    const entry = this.#entries.get(options.host)
    const age = entry ? Date.now() - entry.fetchedAt : Number.POSITIVE_INFINITY

    if (entry && age < this.#freshMs) return entry.resolution

    if (entry && age < this.#freshMs + this.#staleMs) {
      if (!entry.revalidating) {
        entry.revalidating = true
        this.#fetchAndStore(options)
          .catch(() => {
            // Best-effort background revalidation — keep serving the last known-good resolution.
          })
          .finally(() => {
            entry.revalidating = false
          })
      }
      // The stale flag rides the *returned* resolution, not the cached entry:
      // the entry stays byte-identical to what the network last said, and the
      // staleness is a property of this serving decision.
      return { ...entry.resolution, stale: true }
    }

    return this.#fetchAndStore(options)
  }

  async #fetchAndStore(options: FetchTenantContextOptions): Promise<TenantResolution> {
    const resolution = await fetchTenantContext(options)
    this.#entries.set(options.host, { resolution, fetchedAt: Date.now(), revalidating: false })
    return resolution
  }

  clear(): void {
    this.#entries.clear()
  }
}

export function resolveTenantForHost(
  cache: TenantHostCache,
  options: FetchTenantContextOptions,
): Promise<TenantResolution> {
  return cache.resolve(options)
}
