import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../src/client'
import {
  createPaymentConnection,
  createPaymentConnectionSession,
  createTenantCheckout,
  getPaymentConnection,
  getTenantCheckout,
  listPaymentProviders,
} from '../src/payments'
import { createTypedApiClient } from '../src/typed'

function fakeClient(): { client: ApiClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({ ok: true })
  return {
    request,
    client: {
      request,
      requestRaw: vi.fn().mockResolvedValue({ status: 200, body: { ok: true } }),
      get: (path, options) => request(path, { ...options, method: 'GET' }),
      post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
      put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
      patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
      delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
    },
  }
}

describe('payments api functions', () => {
  it('listPaymentProviders calls GET /api/v1/tenant/payments/providers', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await listPaymentProviders(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments/providers',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('createPaymentConnection calls POST /api/v1/tenant/payments/connections with idempotency key', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    const payload = { provider: 'stripe', country: 'US', default_currency: 'USD' }
    await createPaymentConnection(typed, payload, 'key-123')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments/connections',
      expect.objectContaining({
        method: 'POST',
        body: payload,
        idempotencyKey: 'key-123',
      }),
    )
  })

  it('createPaymentConnectionSession calls POST /api/v1/tenant/payments/connections/{id}/session', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await createPaymentConnectionSession(typed, 'conn-456', 'session-key')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments/connections/conn-456/session',
      expect.objectContaining({
        method: 'POST',
        idempotencyKey: 'session-key',
      }),
    )
  })

  it('getPaymentConnection calls GET /api/v1/tenant/payments/connections/{id}', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await getPaymentConnection(typed, 'conn-456')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments/connections/conn-456',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('createTenantCheckout calls POST /api/v1/tenant/checkout with idempotency key', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    const payload = {
      amount_minor: 2000,
      currency: 'JPY',
      reference: 'order-123',
      success_url: 'https://store.example.com/checkout/return',
      cancel_url: 'https://store.example.com/checkout/cancel',
    }
    await createTenantCheckout(typed, payload, 'idemp-key-789')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/checkout',
      expect.objectContaining({
        method: 'POST',
        body: payload,
        idempotencyKey: 'idemp-key-789',
      }),
    )
  })

  it('getTenantCheckout calls GET /api/v1/tenant/checkout/{id}', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await getTenantCheckout(typed, 'chk-abc')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/checkout/chk-abc',
      expect.objectContaining({ method: 'GET' }),
    )
  })
})
