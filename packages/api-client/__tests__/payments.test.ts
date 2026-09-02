import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../src/client'
import {
  createPaymentConnection,
  createPaymentConnectionSession,
  createTenantCheckout,
  exportTenantPayments,
  getPaymentConnection,
  getTaxSettings,
  getTenantCheckout,
  getTenantPayment,
  getTenantTaxSettings,
  listPaymentProviders,
  listPayouts,
  listTenantDisputes,
  listTenantPayments,
  listTenantPayouts,
  refundTenantPayment,
  updateTaxSettings,
  updateTenantTaxSettings,
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

  it('listTenantPayments calls GET /api/v1/tenant/payments with query filters', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    const query = { status: 'succeeded', currency: 'USD', customer: 'cus_123' }
    await listTenantPayments(typed, query)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments',
      expect.objectContaining({
        method: 'GET',
        query,
      }),
    )
  })

  it('getTenantPayment calls GET /api/v1/tenant/payments/{id}', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await getTenantPayment(typed, 'pay-123')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments/pay-123',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('refundTenantPayment calls POST /api/v1/tenant/payments/{id}/refund with idempotency key', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    const body = {
      amount: { currency: 'USD', minor_units: 500 },
      reason: 'requested_by_customer',
      note: 'Customer requested refund',
    }
    await refundTenantPayment(typed, 'pay-123', body, 'idemp-uuid-456')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments/pay-123/refund',
      expect.objectContaining({
        method: 'POST',
        body,
        idempotencyKey: 'idemp-uuid-456',
      }),
    )
  })

  it('listTenantDisputes calls GET /api/v1/tenant/payments/disputes', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    const query = { status: 'needs_response' }
    await listTenantDisputes(typed, query)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments/disputes',
      expect.objectContaining({
        method: 'GET',
        query,
      }),
    )
  })

  it('exportTenantPayments calls GET /api/v1/tenant/payments/export with query filters', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    const query = { status: 'succeeded' }
    await exportTenantPayments(typed, query)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments/export',
      expect.objectContaining({
        method: 'GET',
        query,
      }),
    )
  })

  it('listTenantPayouts calls GET /api/v1/tenant/payments/payouts', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await listTenantPayouts(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments/payouts',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('getTenantTaxSettings calls GET /api/v1/tenant/payments/tax-settings', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await getTenantTaxSettings(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments/tax-settings',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('updateTenantTaxSettings calls PUT /api/v1/tenant/payments/tax-settings with request body', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await updateTenantTaxSettings(typed, { enabled: true })

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments/tax-settings',
      expect.objectContaining({
        method: 'PUT',
        body: { enabled: true },
      }),
    )
  })

  it('aliases listPayouts, getTaxSettings, and updateTaxSettings work identically', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await listPayouts(typed)
    expect(request).toHaveBeenCalledWith('/api/v1/tenant/payments/payouts', expect.anything())

    await getTaxSettings(typed)
    expect(request).toHaveBeenCalledWith('/api/v1/tenant/payments/tax-settings', expect.anything())

    await updateTaxSettings(typed, { enabled: false })
    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/payments/tax-settings',
      expect.objectContaining({ body: { enabled: false } }),
    )
  })
})
