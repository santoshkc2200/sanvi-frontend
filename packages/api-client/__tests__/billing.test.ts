import { describe, expect, it, vi } from 'vitest'
import {
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  listInvoices,
  listPublicPlans,
} from '../src/billing'
import type { ApiClient } from '../src/client'
import { checkSlugAvailability } from '../src/tenancy'
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

describe('billing and tenancy api functions', () => {
  it('listPublicPlans calls GET /api/v1/public/plans', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await listPublicPlans(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/public/plans',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('createCheckoutSession calls POST /api/v1/tenant/billing/checkout-session with body', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    const payload = {
      price_id: '0190f0d0-0000-7000-8000-000000000001',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
    }
    await createCheckoutSession(typed, payload)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/billing/checkout-session',
      expect.objectContaining({ method: 'POST', body: payload }),
    )
  })

  it('createPortalSession calls POST /api/v1/tenant/billing/portal-session with return_url', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await createPortalSession(typed, { return_url: 'https://example.com/billing' })

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/billing/portal-session',
      expect.objectContaining({
        method: 'POST',
        body: { return_url: 'https://example.com/billing' },
      }),
    )
  })

  it('getSubscription calls GET /api/v1/tenant/billing/subscription', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await getSubscription(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/billing/subscription',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('listInvoices calls GET /api/v1/tenant/billing/invoices with query limit', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await listInvoices(typed, { limit: 10 })

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/billing/invoices',
      expect.objectContaining({ method: 'GET', query: { limit: 10 } }),
    )
  })

  it('checkSlugAvailability calls GET /api/v1/public/slug-availability?slug=acme', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await checkSlugAvailability(typed, 'acme')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/public/slug-availability',
      expect.objectContaining({ method: 'GET', query: { slug: 'acme' } }),
    )
  })
})
