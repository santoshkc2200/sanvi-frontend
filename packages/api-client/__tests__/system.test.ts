import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../src/client'
import { getSystemBuild } from '../src/system'
import { createTypedApiClient } from '../src/typed'

function fakeClient(): { client: ApiClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({
    commit: '3d0a5c1e',
    version: '0.1.0',
    built_at: '2026-08-15T09:00:00Z',
    environment: 'local',
  })
  return {
    request,
    client: {
      request,
      requestRaw: vi.fn(),
      requestStream: vi.fn(),
      get: (path, options) => request(path, { ...options, method: 'GET' }),
      post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
      put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
      patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
      delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
    },
  }
}

describe('system api functions', () => {
  it('getSystemBuild calls GET /api/v1/system/build with no auth-dependent options', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)

    const stamp = await getSystemBuild(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/system/build',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(stamp).toEqual({
      commit: '3d0a5c1e',
      version: '0.1.0',
      built_at: '2026-08-15T09:00:00Z',
      environment: 'local',
    })
  })

  it('getSystemBuild forwards an abort signal when given one', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)
    const controller = new AbortController()

    await getSystemBuild(typed, controller.signal)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/system/build',
      expect.objectContaining({ method: 'GET', signal: controller.signal }),
    )
  })
})
