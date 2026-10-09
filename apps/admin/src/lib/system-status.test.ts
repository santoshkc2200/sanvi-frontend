import { getSystemBannerSignal, isTenantRestoring, pollSystemStatus } from './system-status.svelte'
import type { ApiClient } from '@sanvi/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

function fakeRawClient(requestRaw: ReturnType<typeof vi.fn>): ApiClient {
  const request = vi.fn()
  return {
    request,
    requestRaw,
    requestStream: vi.fn(),
    getLastTraceId: vi.fn(() => undefined),
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  }
}

describe('isTenantRestoring (TASK-025 step 5)', () => {
  it('is true only for the restoring status', () => {
    expect(isTenantRestoring('restoring')).toBe(true)
    for (const status of ['active', 'provisioning', 'suspended', 'archived', 'unknown']) {
      expect(isTenantRestoring(status)).toBe(false)
    }
  })
})

describe('system status poll (TASK-025 step 4 — one signal, no second toggle)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('emits no banner before the first poll and none when healthy', async () => {
    expect(getSystemBannerSignal()).toBeNull()
    const requestRaw = vi.fn().mockResolvedValue({
      status: 200,
      body: { status: 'ok', checks: [{ name: 'database', state: 'ok' }] },
    })
    await pollSystemStatus(fakeRawClient(requestRaw))
    expect(getSystemBannerSignal()).toBeNull()
  })

  it('emits the degraded banner from the probe signal without a manual action', async () => {
    const requestRaw = vi.fn().mockResolvedValue({
      status: 503,
      body: {
        status: 'degraded',
        checks: [
          { name: 'database', state: 'degraded' },
          { name: 'redis', state: 'degraded' },
        ],
      },
    })
    await pollSystemStatus(fakeRawClient(requestRaw))
    expect(getSystemBannerSignal()).toEqual({
      kind: 'degraded',
      checks: ['database', 'redis'],
    })
  })

  it('clearing the signal removes the banner', async () => {
    const degraded = vi.fn().mockResolvedValue({
      status: 503,
      body: { status: 'degraded', checks: [{ name: 'redis', state: 'degraded' }] },
    })
    await pollSystemStatus(fakeRawClient(degraded))
    expect(getSystemBannerSignal()).not.toBeNull()

    const healthy = vi.fn().mockResolvedValue({
      status: 200,
      body: { status: 'ok', checks: [{ name: 'redis', state: 'ok' }] },
    })
    await pollSystemStatus(fakeRawClient(healthy))
    expect(getSystemBannerSignal()).toBeNull()
  })
})
