import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { fetchTenantContext, TenantHostCache, TenantResolutionError } from '../src/resolve-host'
import type { TenantContext } from '../src/types'

const TENANT: TenantContext = {
  tenant_id: '11111111-1111-1111-1111-111111111111',
  slug: 'acme',
  display_name: 'Acme Corporation',
  status: 'active',
  region: 'us',
  default_locale: 'en',
  resolution_source: 'subdomain',
}

/** A tiny stand-in for the backend's `/api/v1/public/tenant-context` that resolves by the incoming `Host` header, so tests can prove the header is what actually reaches the server. */
function startFakeBackend(byHost: Record<string, { status: number; body?: unknown }>) {
  const server = createServer((req, res) => {
    const entry = req.headers.host ? byHost[req.headers.host] : undefined
    if (!entry) {
      res.writeHead(500)
      res.end()
      return
    }
    res.writeHead(entry.status, { 'content-type': 'application/json' })
    res.end(entry.body === undefined ? '' : JSON.stringify(entry.body))
  })
  return new Promise<{ apiOrigin: string; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({
        apiOrigin: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      })
    })
  })
}

describe('fetchTenantContext', () => {
  it('sends the tenant host as the Host header, not the API origin host', async () => {
    const backend = await startFakeBackend({ 'acme.example': { status: 200, body: TENANT } })
    try {
      const resolution = await fetchTenantContext({
        apiOrigin: backend.apiOrigin,
        host: 'acme.example',
      })
      expect(resolution).toEqual({ status: 'ok', tenant: TENANT })
    } finally {
      await backend.close()
    }
  })

  it('maps a 404 to an unknown-host resolution rather than throwing', async () => {
    const backend = await startFakeBackend({ 'ghost.example': { status: 404 } })
    try {
      const resolution = await fetchTenantContext({
        apiOrigin: backend.apiOrigin,
        host: 'ghost.example',
      })
      expect(resolution).toEqual({ status: 'unknown-host', tenant: null })
    } finally {
      await backend.close()
    }
  })

  it('rejects with TenantResolutionError on a 5xx', async () => {
    const backend = await startFakeBackend({ 'broken.example': { status: 502 } })
    try {
      await expect(
        fetchTenantContext({ apiOrigin: backend.apiOrigin, host: 'broken.example' }),
      ).rejects.toBeInstanceOf(TenantResolutionError)
    } finally {
      await backend.close()
    }
  })
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('TenantHostCache', () => {
  it('serves a fresh entry without a second network call', async () => {
    const backend = await startFakeBackend({ 'acme.example': { status: 200, body: TENANT } })
    const cache = new TenantHostCache({ freshMs: 60_000, staleMs: 60_000 })
    try {
      const first = await cache.resolve({ apiOrigin: backend.apiOrigin, host: 'acme.example' })
      await backend.close() // if this call happened again, the missing server would throw a connection error
      const second = await cache.resolve({ apiOrigin: backend.apiOrigin, host: 'acme.example' })
      expect(first).toEqual(second)
    } finally {
      await backend.close().catch(() => {})
    }
  })

  it('scopes cache entries by host, never mixing tenants', async () => {
    const other: TenantContext = {
      ...TENANT,
      tenant_id: '22222222-2222-2222-2222-222222222222',
      slug: 'globex',
    }
    const backend = await startFakeBackend({
      'acme.example': { status: 200, body: TENANT },
      'globex.example': { status: 200, body: other },
    })
    const cache = new TenantHostCache()
    try {
      const acme = await cache.resolve({ apiOrigin: backend.apiOrigin, host: 'acme.example' })
      const globex = await cache.resolve({ apiOrigin: backend.apiOrigin, host: 'globex.example' })
      expect(acme.tenant?.slug).toBe('acme')
      expect(globex.tenant?.slug).toBe('globex')
    } finally {
      await backend.close()
    }
  })

  it('serves a stale entry immediately and revalidates in the background', async () => {
    const backend = await startFakeBackend({ 'acme.example': { status: 200, body: TENANT } })
    const cache = new TenantHostCache({ freshMs: 10, staleMs: 60_000 })
    try {
      await cache.resolve({ apiOrigin: backend.apiOrigin, host: 'acme.example' })
      await sleep(30) // now stale, not expired

      const resolution = await cache.resolve({ apiOrigin: backend.apiOrigin, host: 'acme.example' })
      expect(resolution.status).toBe('ok') // served immediately from the stale entry, not blocked on revalidation
    } finally {
      await backend.close()
    }
  })

  it("flags a stale-while-revalidate hit so the UI can say what's stale (TASK-023)", async () => {
    const backend = await startFakeBackend({ 'acme.example': { status: 200, body: TENANT } })
    const cache = new TenantHostCache({ freshMs: 10, staleMs: 60_000 })
    try {
      const fresh = await cache.resolve({ apiOrigin: backend.apiOrigin, host: 'acme.example' })
      expect(fresh.stale).toBeUndefined()
      await sleep(30) // now stale, not expired

      const stale = await cache.resolve({ apiOrigin: backend.apiOrigin, host: 'acme.example' })
      expect(stale.status).toBe('ok')
      expect(stale.stale).toBe(true)
    } finally {
      await backend.close()
    }
  })

  it('negative-caches an unknown host the same way as a resolved one', async () => {
    const backend = await startFakeBackend({ 'ghost.example': { status: 404 } })
    const cache = new TenantHostCache({ freshMs: 60_000 })
    try {
      const first = await cache.resolve({ apiOrigin: backend.apiOrigin, host: 'ghost.example' })
      await backend.close()
      const second = await cache.resolve({ apiOrigin: backend.apiOrigin, host: 'ghost.example' })
      expect(first).toEqual({ status: 'unknown-host', tenant: null })
      expect(second).toEqual(first)
    } finally {
      await backend.close().catch(() => {})
    }
  })

  it('clear() forces the next resolve() to hit the network again', async () => {
    const backend = await startFakeBackend({ 'acme.example': { status: 200, body: TENANT } })
    const cache = new TenantHostCache({ freshMs: 60_000 })
    await cache.resolve({ apiOrigin: backend.apiOrigin, host: 'acme.example' })
    cache.clear()
    await backend.close()

    await expect(
      cache.resolve({ apiOrigin: backend.apiOrigin, host: 'acme.example' }),
    ).rejects.toBeTruthy()
  })
})
