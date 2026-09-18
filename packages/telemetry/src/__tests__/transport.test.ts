import { describe, expect, it, vi } from 'vitest'
import type { TelemetryEvent } from '../types'
import { createBeaconTransport, createNullTransport } from '../transport'

function event(overrides: Partial<TelemetryEvent> = {}): TelemetryEvent {
  return {
    kind: 'vital',
    name: 'LCP',
    value: 1234,
    rating: 'good',
    durationMs: null,
    transferBytes: null,
    resourceUrl: null,
    purpose: 'analytics',
    timestamp: 0,
    sampleRate: 1,
    release: {
      commit: 'e2eb1d9',
      version: '0.1.0',
      built_at: '2026-01-01T00:00:00Z',
      environment: 'local',
    },
    segmentation: {
      route: '/',
      tenantId: null,
      locale: 'en',
      deviceClass: 'desktop',
      themeRevision: null,
    },
    ...overrides,
  }
}

describe('createNullTransport', () => {
  it('accepts anything and does nothing', () => {
    const transport = createNullTransport()
    expect(() => transport([event()])).not.toThrow()
  })
})

describe('createBeaconTransport', () => {
  it('posts one JSON batch with keepalive and no credentials', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
    const transport = createBeaconTransport({ endpoint: 'https://t.example/collect', fetchImpl })

    transport([event(), event({ name: 'CLS', value: 0.01, rating: 'good' })])

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe('https://t.example/collect')
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
    })
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.events).toHaveLength(2)
  })

  it('sends nothing for an empty batch', () => {
    const fetchImpl = vi.fn()
    const transport = createBeaconTransport({ endpoint: 'https://t.example/collect', fetchImpl })
    transport([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('swallows a rejecting fetch — telemetry never breaks the page', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    const transport = createBeaconTransport({ endpoint: 'https://t.example/collect', fetchImpl })
    expect(() => transport([event()])).not.toThrow()
    await Promise.resolve()
  })

  it('swallows a throwing fetch constructor', () => {
    const fetchImpl = vi.fn(() => {
      throw new Error('blocked by policy')
    })
    const transport = createBeaconTransport({ endpoint: 'https://t.example/collect', fetchImpl })
    expect(() => transport([event()])).not.toThrow()
  })
})
