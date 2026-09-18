import { describe, expect, it, vi } from 'vitest'
import { ConsentStore } from '@sanvi/consent'
import type { DirectiveSnapshot } from '@sanvi/consent'
import { initTelemetry } from '../collector'
import type {
  RawObservation,
  ReleaseStamp,
  TelemetryEvent,
  TelemetrySources,
  TelemetryTransport,
} from '../types'

const RELEASE: ReleaseStamp = {
  commit: 'e2eb1d9',
  version: '0.1.0',
  built_at: '2026-01-01T00:00:00Z',
  environment: 'local',
}

function usSnapshot(): DirectiveSnapshot {
  return {
    subject: { key: 'subject-1', kind: 'device', identifiers: [] },
    jurisdiction: 'us-ca',
    directives: [
      {
        purpose: 'analytics',
        state: 'allowed',
        source: 'default',
        effective_at: '2026-01-01T00:00:00Z',
        jurisdiction: 'us-ca',
        notice_version: '2026.1',
      },
    ],
    honours_universal_opt_out: true,
  }
}

function collectingHarness(batchLimit = 20) {
  let emit: ((observation: RawObservation) => void) | null = null
  const source: TelemetrySources = {
    start(onEvent) {
      emit = onEvent
      return () => {
        emit = null
      }
    },
  }
  const batches: TelemetryEvent[][] = []
  const send = vi.fn((events: TelemetryEvent[]) => {
    batches.push(events)
  }) as TelemetryTransport
  const telemetry = initTelemetry({
    enabled: true,
    endpoint: 'https://telemetry.example.test/collect',
    store: new ConsentStore({ snapshot: usSnapshot(), consentModel: 'notice_and_opt_out' }),
    release: RELEASE,
    segmentation: () => ({
      route: '/campaigns',
      tenantId: 'tenant-1',
      locale: 'en',
      deviceClass: 'desktop',
      themeRevision: 7,
    }),
    transport: send,
    sources: [source],
    batchLimit,
  })
  return {
    telemetry,
    send,
    batches,
    push: (observation: RawObservation) => emit?.(observation),
  }
}

describe('collector mechanics', () => {
  it('flushes automatically when the batch limit is reached', () => {
    const { batches, push } = collectingHarness(2)
    push({ kind: 'vital', name: 'LCP', value: 800, rating: 'good' })
    expect(batches).toHaveLength(0)
    push({ kind: 'vital', name: 'CLS', value: 0.02, rating: 'good' })
    expect(batches).toHaveLength(1)
    expect(batches[0]).toHaveLength(2)
  })

  it('every event carries the release stamp and collection-time segmentation', () => {
    const { batches, push } = collectingHarness(1)
    push({ kind: 'navigation', name: 'load', value: 540 })
    const event = batches[0]?.[0]
    expect(event).toMatchObject({
      kind: 'navigation',
      name: 'load',
      value: 540,
      purpose: 'analytics',
      release: RELEASE,
      segmentation: {
        route: '/campaigns',
        tenantId: 'tenant-1',
        locale: 'en',
        deviceClass: 'desktop',
        themeRevision: 7,
      },
    })
  })

  it('dispose is idempotent and stops everything', () => {
    const { telemetry, push, send } = collectingHarness(1)
    push({ kind: 'vital', name: 'LCP', value: 800, rating: 'good' })
    telemetry.dispose()
    telemetry.dispose()
    push({ kind: 'vital', name: 'LCP', value: 800, rating: 'good' })
    telemetry.flush()
    expect(send).toHaveBeenCalledTimes(1)
    expect(telemetry.isCollecting()).toBe(false)
  })

  it('after disposal the source is stopped, so nothing further is observed — never existing, not dropped', () => {
    const { telemetry, push, send } = collectingHarness(20)
    telemetry.dispose()
    push({ kind: 'vital', name: 'LCP', value: 800, rating: 'good' })
    telemetry.flush()
    expect(send).not.toHaveBeenCalled()
    // The observation never existed: the source's stop contract, not the
    // collector's drop counter, is what guarantees silence after dispose.
    expect(telemetry.droppedCount()).toBe(0)
  })

  it('a sampling rate below 1 is stamped on every event, so a query can tell sampled from unsampled data', () => {
    let emit: ((observation: RawObservation) => void) | null = null
    const source: TelemetrySources = {
      start(onEvent) {
        emit = onEvent
        return () => {
          emit = null
        }
      },
    }
    const batches: TelemetryEvent[][] = []
    const send = vi.fn((events: TelemetryEvent[]) => {
      batches.push(events)
    }) as TelemetryTransport
    const telemetry = initTelemetry({
      enabled: true,
      endpoint: 'https://telemetry.example.test/collect',
      store: new ConsentStore({ snapshot: usSnapshot(), consentModel: 'notice_and_opt_out' }),
      release: RELEASE,
      sampleRate: 0.1,
      rng: () => 0.05, // below the rate — this page participates
      segmentation: () => ({
        route: '/',
        tenantId: null,
        locale: 'en',
        deviceClass: 'desktop',
        themeRevision: null,
      }),
      transport: send,
      sources: [source],
    })

    const push = (observation: RawObservation) => emit?.(observation)

    expect(telemetry.isCollecting()).toBe(true)
    push({ kind: 'vital', name: 'LCP', value: 800, rating: 'good' })
    telemetry.flush()
    expect(batches[0]?.[0]?.sampleRate).toBe(0.1)
  })

  it('an rng draw at or above the rate samples the page out entirely', () => {
    const telemetry = initTelemetry({
      enabled: true,
      endpoint: 'https://telemetry.example.test/collect',
      store: new ConsentStore({ snapshot: usSnapshot(), consentModel: 'notice_and_opt_out' }),
      release: RELEASE,
      sampleRate: 0.1,
      rng: () => 0.5,
      segmentation: () => ({
        route: '/',
        tenantId: null,
        locale: 'en',
        deviceClass: 'desktop',
        themeRevision: null,
      }),
      transport: vi.fn(),
      sources: [
        {
          start: () => () => {},
        },
      ],
    })
    expect(telemetry.isCollecting()).toBe(false)
  })
})
