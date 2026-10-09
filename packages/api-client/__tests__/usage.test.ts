import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../src/client'
import { createTypedApiClient } from '../src/typed'
import { getTenantUsage, QUOTA_DIMENSIONS } from '../src/usage'

function fakeClient(): { client: ApiClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({ ok: true })
  return {
    request,
    client: {
      request,
      requestRaw: vi.fn().mockResolvedValue({ status: 200, body: { ok: true } }),
      requestStream: vi.fn().mockResolvedValue(new ReadableStream()),
      getLastTraceId: vi.fn(() => undefined),
      get: (path, options) => request(path, { ...options, method: 'GET' }),
      post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
      put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
      patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
      delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
    },
  }
}

describe('usage api functions', () => {
  it('getTenantUsage calls GET /api/v1/tenant/usage', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)
    request.mockResolvedValueOnce({
      plan: 'starter',
      period_start: '2026-10-01T00:00:00Z',
      period_end: '2026-11-01T00:00:00Z',
      dimensions: { seats: { used: 3, limit: 5 } },
    })

    const usage = await getTenantUsage(typed)

    expect(request).toHaveBeenCalledWith('/api/v1/tenant/usage', { method: 'GET' })
    expect(usage.dimensions['seats']).toEqual({ used: 3, limit: 5 })
  })

  it('QUOTA_DIMENSIONS covers the six metered dimensions in display order', () => {
    expect([...QUOTA_DIMENSIONS]).toEqual([
      'api_requests',
      'tracked_conversions',
      'storage_bytes',
      'custom_domains',
      'seats',
      'notification_sends',
    ])
  })
})
