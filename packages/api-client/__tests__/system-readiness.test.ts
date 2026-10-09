import { describe, expect, it, vi, expectTypeOf } from 'vitest'
import type { ApiClient } from '../src/client'
import { ApiError } from '../src/problem'
import {
  getSystemHealth,
  getSystemReadiness,
  systemBannerFor,
  type DependencyState,
  type HealthState,
  type LivenessResult,
  type ReadinessStates,
} from '../src/system'

function fakeApiClient(request: ReturnType<typeof vi.fn>): ApiClient {
  const requestRaw = vi.fn()
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

function fakeReadinessClient(body: unknown, status = 200): ApiClient {
  const request = vi.fn()
  const client = fakeApiClient(request)
  vi.mocked(client.requestRaw).mockResolvedValue({ status, body: body as never })
  return client
}

describe('system probes (TASK-025 step 1)', () => {
  it('ReadinessStates carries states only — no hostname, version, or error-string field (type level)', () => {
    expectTypeOf<keyof ReadinessStates>().toEqualTypeOf<'status' | 'checks'>()
    expectTypeOf<ReadinessStates>().toEqualTypeOf<{
      status: HealthState
      checks: DependencyState[]
    }>()
    expectTypeOf<keyof DependencyState>().toEqualTypeOf<'name' | 'state'>()
    expectTypeOf<DependencyState['state']>().toEqualTypeOf<HealthState>()
    expectTypeOf<HealthState>().toEqualTypeOf<'ok' | 'degraded'>()
    expectTypeOf<keyof LivenessResult>().toEqualTypeOf<'status'>()
    // Negative pins: the reconnaissance fields must never typecheck here.
    expectTypeOf<ReadinessStates>().not.toMatchTypeOf<{ hostname: string }>()
    expectTypeOf<ReadinessStates>().not.toMatchTypeOf<{ version: string }>()
    expectTypeOf<ReadinessStates>().not.toMatchTypeOf<{ error: string }>()
    expectTypeOf<ReadinessStates>().not.toMatchTypeOf<{ detail: string }>()
    expectTypeOf<DependencyState>().not.toMatchTypeOf<{ detail: string }>()
  })

  it('getSystemHealth calls GET /api/v1/system/health with no retries', async () => {
    const request = vi.fn().mockResolvedValue({ status: 'ok' })
    const client = fakeApiClient(request)

    const result = await getSystemHealth(client)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/system/health',
      expect.objectContaining({ method: 'GET', retries: 0 }),
    )
    expect(result).toEqual({ status: 'ok' })
  })

  it('getSystemReadiness returns the states on 200', async () => {
    const states: ReadinessStates = {
      status: 'ok',
      checks: [{ name: 'database', state: 'ok' }],
    }
    const client = fakeReadinessClient(states, 200)

    await expect(getSystemReadiness(client)).resolves.toEqual(states)
    expect(client.requestRaw).toHaveBeenCalledWith(
      '/api/v1/system/ready',
      expect.objectContaining({ method: 'GET', retries: 0 }),
    )
  })

  it('getSystemReadiness returns the degraded states on 503 instead of throwing', async () => {
    const states: ReadinessStates = {
      status: 'degraded',
      checks: [
        { name: 'database', state: 'ok' },
        { name: 'redis', state: 'degraded' },
      ],
    }
    const client = fakeReadinessClient(states, 503)

    await expect(getSystemReadiness(client)).resolves.toEqual(states)
  })

  it('getSystemReadiness throws an ApiError when the body is not states', async () => {
    const client = fakeReadinessClient(
      { type: 'about:blank', title: 'Internal Server Error', status: 500 },
      500,
    )

    const error = await getSystemReadiness(client).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(500)
  })

  it('readiness wire shape carries no hostname, version, or error-string key (runtime mirror)', async () => {
    const states: ReadinessStates = {
      status: 'degraded',
      checks: [{ name: 'database', state: 'degraded' }],
    }
    const client = fakeReadinessClient(states, 503)

    const result = await getSystemReadiness(client)

    expect(Object.keys(result).sort()).toEqual(['checks', 'status'])
    for (const check of result.checks) {
      expect(Object.keys(check).sort()).toEqual(['name', 'state'])
    }
    expect(JSON.stringify(result)).not.toMatch(/hostname|version|error|detail|stack/i)
  })
})

describe('systemBannerFor (TASK-025 step 4 — one signal, no second toggle)', () => {
  it('returns null when every dependency is healthy', () => {
    expect(
      systemBannerFor({ status: 'ok', checks: [{ name: 'database', state: 'ok' }] }, undefined),
    ).toBeNull()
  })

  it('maps an unreachable probe to a persistent degraded banner', () => {
    expect(systemBannerFor(null, new Error('unreachable'))).toEqual({
      kind: 'degraded',
      checks: [],
    })
  })

  it('maps a single degraded dependency to a dismissible maintenance banner naming it', () => {
    expect(
      systemBannerFor(
        {
          status: 'degraded',
          checks: [
            { name: 'database', state: 'ok' },
            { name: 'redis', state: 'degraded' },
          ],
        },
        undefined,
      ),
    ).toEqual({ kind: 'maintenance', checks: ['redis'] })
  })

  it('maps several degraded dependencies to a persistent degraded banner naming them', () => {
    expect(
      systemBannerFor(
        {
          status: 'degraded',
          checks: [
            { name: 'database', state: 'degraded' },
            { name: 'redis', state: 'degraded' },
          ],
        },
        undefined,
      ),
    ).toEqual({ kind: 'degraded', checks: ['database', 'redis'] })
  })
})
