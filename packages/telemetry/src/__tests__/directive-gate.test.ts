import { describe, expect, it, vi } from 'vitest'
import { ConsentStore } from '@sanvi/consent'
import type { DirectiveSnapshot, ProcessingPurpose } from '@sanvi/consent'
import { initTelemetry } from '../collector'
import type {
  ReleaseStamp,
  RawObservation,
  TelemetryEvent,
  TelemetrySegmentation,
  TelemetrySources,
  TelemetryTransport,
} from '../types'

function snapshot(us = false, analyticsState?: 'allowed' | 'denied'): DirectiveSnapshot {
  const jurisdiction = us ? 'us-ca' : 'eu'
  const purposes: ProcessingPurpose[] = [
    'analytics',
    'marketing_email',
    'ads_personalisation',
    'ads_measurement',
    'session_replay',
    'sale_or_share',
    'targeted_advertising',
    'profiling_significant_effects',
    'sensitive_pi_use',
  ]
  return {
    subject: { key: 'subject-1', kind: 'device', identifiers: [] },
    jurisdiction,
    directives: purposes.map((purpose) => ({
      purpose,
      // `analyticsState` forces an explicit resolver denial regardless of the
      // mode default — the suppression assertions below must hold when the
      // resolver denies, not only when a mode happens to default to denial.
      state: purpose === 'analytics' && analyticsState ? analyticsState : us ? 'allowed' : 'denied',
      source: purpose === 'analytics' && analyticsState === 'denied' ? 'opt_out' : 'default',
      effective_at: '2026-01-01T00:00:00Z',
      jurisdiction,
      notice_version: '2026.1',
    })),
    honours_universal_opt_out: true,
  }
}

const RELEASE: ReleaseStamp = {
  commit: 'e2eb1d9',
  version: '0.1.0',
  built_at: '2026-01-01T00:00:00Z',
  environment: 'local',
}

const SEGMENTATION: TelemetrySegmentation = {
  route: '/products/[id]',
  tenantId: '11111111-1111-1111-1111-111111111111',
  locale: 'ja',
  deviceClass: 'desktop',
  themeRevision: 3,
}

function segmentationOf(): TelemetrySegmentation {
  return { ...SEGMENTATION }
}

/** A fake observation source: records whether it was ever started, lets tests push raw observations. */
function recordingSource() {
  const started = vi.fn()
  const stopped = vi.fn()
  let emit: ((observation: RawObservation) => void) | null = null
  const source: TelemetrySources = {
    start(onEvent) {
      started()
      emit = onEvent
      return () => {
        emit = null
        stopped()
      }
    },
  }
  return {
    source,
    started,
    stopped,
    push: (observation: RawObservation) => emit?.(observation),
  }
}

function transport(): TelemetryTransport & { batches: TelemetryEvent[][] } {
  const batches: TelemetryEvent[][] = []
  const send = vi.fn((events: TelemetryEvent[]) => {
    batches.push(events)
  })
  const transport = send as unknown as TelemetryTransport & { batches: TelemetryEvent[][] }
  transport.batches = batches
  return transport
}

const LCP_OBSERVATION: RawObservation = { kind: 'vital', name: 'LCP', value: 1200, rating: 'good' }
const RESOURCE_OBSERVATION: RawObservation = {
  kind: 'resource',
  url: 'https://cdn.example.test/fonts/jp.woff2?email=user@example.test&session_token=abc123',
  durationMs: 320,
  transferBytes: 48211,
}

/** Observations carrying a query-stringed URL — scrubbing must strip every one. */
function adversarialObservations(): RawObservation[] {
  return [LCP_OBSERVATION, RESOURCE_OBSERVATION]
}

describe('directive gate — suppression is the default', () => {
  it('EU opt-in, resolver defaulting to deny: nothing is emitted at all — no batch, no source start', () => {
    const store = new ConsentStore({ snapshot: snapshot(false), consentModel: 'opt_in' })
    const src = recordingSource()
    const send = transport()

    const telemetry = initTelemetry({
      enabled: true,
      endpoint: 'https://telemetry.example.test/collect',
      store,
      release: RELEASE,
      sampleRate: 1,
      segmentation: segmentationOf,
      transport: send,
      sources: [src.source],
    })

    expect(telemetry.isCollecting()).toBe(false)
    // Not a reduced payload, not a sampled one: the source is never started,
    // so no observation is ever even taken.
    expect(src.started).not.toHaveBeenCalled()
    src.push(LCP_OBSERVATION)
    telemetry.flush()
    expect(send).not.toHaveBeenCalled()
    telemetry.dispose()
  })

  it('US notice-and-opt-out, resolver denying: same total suppression', () => {
    // Explicit opt-out denial in a notice-and-opt-out jurisdiction — the
    // mode where a naive implementation would keep collecting because the
    // banner never blocked the page.
    const store = new ConsentStore({
      snapshot: snapshot(true, 'denied'),
      consentModel: 'notice_and_opt_out',
    })
    const src = recordingSource()
    const send = transport()

    const telemetry = initTelemetry({
      enabled: true,
      endpoint: 'https://telemetry.example.test/collect',
      store,
      release: RELEASE,
      sampleRate: 1,
      segmentation: segmentationOf,
      transport: send,
      sources: [src.source],
    })

    expect(telemetry.isCollecting()).toBe(false)
    expect(src.started).not.toHaveBeenCalled()
    src.push(LCP_OBSERVATION)
    telemetry.flush()
    expect(send).not.toHaveBeenCalled()
    telemetry.dispose()
  })

  it('no consent store wired: suppressed (deny-all), whatever the mode would have said', () => {
    const src = recordingSource()
    const send = transport()

    const telemetry = initTelemetry({
      enabled: true,
      endpoint: 'https://telemetry.example.test/collect',
      store: null,
      release: RELEASE,
      segmentation: segmentationOf,
      transport: send,
      sources: [src.source],
    })

    expect(telemetry.isCollecting()).toBe(false)
    expect(src.started).not.toHaveBeenCalled()
    telemetry.dispose()
  })

  it('EU consent granted: collection starts and events flow', () => {
    const store = new ConsentStore({ snapshot: snapshot(false), consentModel: 'opt_in' })
    const src = recordingSource()
    const send = transport()

    const telemetry = initTelemetry({
      enabled: true,
      endpoint: 'https://telemetry.example.test/collect',
      store,
      release: RELEASE,
      segmentation: segmentationOf,
      transport: send,
      sources: [src.source],
    })

    expect(telemetry.isCollecting()).toBe(false)
    store.acceptAll()
    expect(telemetry.isCollecting()).toBe(true)
    expect(src.started).toHaveBeenCalledTimes(1)

    for (const observation of adversarialObservations()) src.push(observation)
    telemetry.flush()

    expect(send).toHaveBeenCalledTimes(1)
    const events = send.batches[0] ?? []
    expect(events).toHaveLength(2)
    for (const event of events) {
      expect(event.release).toEqual(RELEASE)
      expect(event.segmentation).toEqual(SEGMENTATION)
      expect(event.purpose).toBe('analytics')
    }
    telemetry.dispose()
  })

  it('revocation mid-session stops collection and drops the buffer — nothing queued for later', () => {
    const store = new ConsentStore({ snapshot: snapshot(false), consentModel: 'opt_in' })
    const src = recordingSource()
    const send = transport()

    const telemetry = initTelemetry({
      enabled: true,
      endpoint: 'https://telemetry.example.test/collect',
      store,
      release: RELEASE,
      segmentation: segmentationOf,
      transport: send,
      sources: [src.source],
    })

    store.acceptAll()
    src.push(LCP_OBSERVATION)
    store.setDecision('analytics', false)
    expect(telemetry.isCollecting()).toBe(false)
    expect(src.stopped).toHaveBeenCalled()

    telemetry.flush()
    expect(send).not.toHaveBeenCalled()
    telemetry.dispose()
  })

  it('US mode default: analytics flows, a statutory opt-out does not stop it, a direct denial does', () => {
    const store = new ConsentStore({
      snapshot: snapshot(true),
      consentModel: 'notice_and_opt_out',
    })
    const src = recordingSource()
    const send = transport()

    const telemetry = initTelemetry({
      enabled: true,
      endpoint: 'https://telemetry.example.test/collect',
      store,
      release: RELEASE,
      segmentation: segmentationOf,
      transport: send,
      sources: [src.source],
    })

    // Notice-and-opt-out defaults to allowed — collection runs without a banner click.
    expect(telemetry.isCollecting()).toBe(true)
    src.push(LCP_OBSERVATION)

    // The statutory one-click opt-out flips the sale/share family, not
    // measurement — analytics-purposed telemetry keeps flowing.
    store.optOut('ui')
    expect(telemetry.isCollecting()).toBe(true)
    src.push(LCP_OBSERVATION)
    telemetry.flush()
    expect(send.batches[0]).toHaveLength(2)

    // A direct denial of the purpose itself stops it.
    store.setDecision('analytics', false)
    expect(telemetry.isCollecting()).toBe(false)
    telemetry.dispose()
  })
})

describe('payload hygiene — no PII, no query strings, ever', () => {
  it('no emitted payload contains an email, a session token, or a full URL with a query string', () => {
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const src = recordingSource()
    const send = transport()

    const telemetry = initTelemetry({
      enabled: true,
      endpoint: 'https://telemetry.example.test/collect',
      store,
      release: RELEASE,
      segmentation: () => ({
        route: '/search?q=user%40example.test&session_token=abc', // adversarial route
        tenantId: 'tenant@example.test',
        locale: 'en',
        deviceClass: 'mobile',
        themeRevision: null,
      }),
      transport: send,
      sources: [src.source],
    })

    for (const observation of adversarialObservations()) src.push(observation)
    telemetry.flush()
    telemetry.dispose()

    expect(send).toHaveBeenCalled()
    const serialized = JSON.stringify(send.batches)
    expect(serialized).not.toContain('?')
    expect(serialized).not.toContain('@')
    expect(serialized.toLowerCase()).not.toContain('token')
    expect(serialized.toLowerCase()).not.toContain('email')
  })
})
