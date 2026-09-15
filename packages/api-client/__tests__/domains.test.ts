import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../src/client'
import {
  claimCustomDomain,
  getDomainInstructions,
  listCustomDomains,
  listDomainOrders,
  placeDomainOrder,
  promoteDomain,
  removeCustomDomain,
  requestDomainVerification,
  searchDomains,
  setOrderAutoRenew,
} from '../src/domains'
import { createTypedApiClient } from '../src/typed'

function fakeClient(): { client: ApiClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({ ok: true })
  return {
    request,
    client: {
      request,
      requestRaw: vi.fn().mockResolvedValue({ status: 200, body: { ok: true } }),
      requestStream: vi.fn().mockResolvedValue(new ReadableStream()),
      get: (path, options) => request(path, { ...options, method: 'GET' }),
      post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
      put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
      patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
      delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
    },
  }
}

describe('domains api client functions', () => {
  it('listCustomDomains calls GET /api/v1/tenant/domains', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await listCustomDomains(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/domains',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('claimCustomDomain calls POST /api/v1/tenant/domains with hostname and role', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await claimCustomDomain(typed, 'shop.example.com', 'primary')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/domains',
      expect.objectContaining({
        method: 'POST',
        body: { hostname: 'shop.example.com', role: 'primary' },
      }),
    )
  })

  it('claimCustomDomain accepts object command payload', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await claimCustomDomain(typed, { hostname: 'alias.example.com', role: 'alias' })

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/domains',
      expect.objectContaining({
        method: 'POST',
        body: { hostname: 'alias.example.com', role: 'alias' },
      }),
    )
  })

  it('removeCustomDomain calls DELETE /api/v1/tenant/domains/{id}', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await removeCustomDomain(typed, 'dom_123')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/domains/dom_123',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('getDomainInstructions calls GET /api/v1/tenant/domains/{id}/instructions with query', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await getDomainInstructions(typed, 'dom_123', { locale: 'ja' })

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/domains/dom_123/instructions',
      expect.objectContaining({ method: 'GET', query: { locale: 'ja' } }),
    )
  })

  it('promoteDomain calls POST /api/v1/tenant/domains/{id}/promote', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await promoteDomain(typed, 'dom_123')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/domains/dom_123/promote',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('requestDomainVerification calls POST /api/v1/tenant/domains/{id}/verify', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await requestDomainVerification(typed, 'dom_123')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/domains/dom_123/verify',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('searchDomains calls GET /api/v1/tenant/domains/search?q=acme', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await searchDomains(typed, 'acme')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/domains/search',
      expect.objectContaining({ method: 'GET', query: { q: 'acme' } }),
    )
  })

  it('placeDomainOrder calls POST /api/v1/tenant/domains/orders with body', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    const registrant = {
      name: 'Alice Smith',
      email: 'alice@example.com',
      phone: '+1.5551234567',
      country_code: 'US',
    }

    await placeDomainOrder(typed, 'acme-corp.com', 1, true, true, registrant)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/domains/orders',
      expect.objectContaining({
        method: 'POST',
        body: {
          hostname: 'acme-corp.com',
          term_years: 1,
          auto_renew: true,
          whois_privacy: true,
          registrant_contact: registrant,
        },
      }),
    )
  })

  it('listDomainOrders calls GET /api/v1/tenant/domains/orders', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await listDomainOrders(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/domains/orders',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('setOrderAutoRenew calls POST /api/v1/tenant/domains/orders/{id}/auto-renew', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await setOrderAutoRenew(typed, 'ord_123', true)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/domains/orders/ord_123/auto-renew',
      expect.objectContaining({
        method: 'POST',
        body: { enabled: true },
      }),
    )
  })
})
