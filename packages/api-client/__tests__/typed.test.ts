import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../src/client'
import { createTypedApiClient, substitutePathParams } from '../src/typed'

function fakeClient(): { client: ApiClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({ ok: true })
  return {
    request,
    client: {
      request,
      get: (path, options) => request(path, { ...options, method: 'GET' }),
      post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
      put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
      patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
      delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
    },
  }
}

describe('substitutePathParams', () => {
  it('replaces every {name} segment with its encoded value', () => {
    expect(substitutePathParams('/api/v1/platform/tenants/{id}', { id: 'acme co' })).toBe(
      '/api/v1/platform/tenants/acme%20co',
    )
  })

  it('throws when a required param is missing rather than sending a literal placeholder', () => {
    expect(() => substitutePathParams('/api/v1/platform/tenants/{id}', undefined)).toThrow(
      /Missing path parameter "id"/,
    )
  })

  it('is a no-op for a path with no placeholders', () => {
    expect(substitutePathParams('/api/v1/public/tenant-context', undefined)).toBe(
      '/api/v1/public/tenant-context',
    )
  })
})

describe('createTypedApiClient', () => {
  it('GET substitutes path params and forwards query params through the runtime client', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await typed.GET('/api/v1/platform/tenants/{id}', { params: { path: { id: 'tenant-1' } } })

    expect(request).toHaveBeenCalledWith(
      '/api/v1/platform/tenants/tenant-1',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('GET with no path params calls the literal path', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    await typed.GET('/api/v1/public/tenant-context')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/public/tenant-context',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('POST forwards the body untouched', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    const command = { slug: 'acme', display_name: 'Acme', region: 'us' }
    await typed.POST('/api/v1/platform/tenants', command)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/platform/tenants',
      expect.objectContaining({ method: 'POST', body: command }),
    )
  })
})
