import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConsentStore } from '@sanvi/consent'
import type { DirectiveSnapshot } from '@sanvi/consent'
import { initTelemetry } from '../collector'
import type { RawObservation, ReleaseStamp, TelemetrySources } from '../types'

const RELEASE: ReleaseStamp = {
  commit: 'e2eb1d9',
  version: '0.1.0',
  built_at: '2026-01-01T00:00:00Z',
  environment: 'local',
}

function snapshot(us = false): DirectiveSnapshot {
  const jurisdiction = us ? 'us-ca' : 'eu'
  return {
    subject: { key: 'subject-1', kind: 'device', identifiers: [] },
    jurisdiction,
    directives: [
      {
        purpose: 'analytics',
        state: us ? 'allowed' : 'denied',
        source: 'default',
        effective_at: '2026-01-01T00:00:00Z',
        jurisdiction,
        notice_version: '2026.1',
      },
    ],
    honours_universal_opt_out: true,
  }
}

function recordingSource() {
  let emit: ((observation: RawObservation) => void) | null = null
  const source: TelemetrySources = {
    start(onEvent) {
      emit = onEvent
      return () => {
        emit = null
      }
    },
  }
  return { source, push: (observation: RawObservation) => emit?.(observation) }
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('collection disabled — the package makes no network request', () => {
  it('never fetches, never starts a source, even against an allowed store', () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const src = recordingSource()

    const telemetry = initTelemetry({
      enabled: false,
      endpoint: 'https://telemetry.example.test/collect',
      store,
      release: RELEASE,
      segmentation: () => ({
        route: '/',
        tenantId: null,
        locale: 'en',
        deviceClass: 'desktop',
        themeRevision: null,
      }),
      sources: [src.source],
    })

    expect(telemetry.isCollecting()).toBe(false)
    src.push({ kind: 'vital', name: 'LCP', value: 900, rating: 'good' })
    telemetry.flush()
    expect(telemetry.droppedCount()).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    telemetry.dispose()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('enabled but no endpoint: events are still never sent anywhere', () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const src = recordingSource()

    // No `endpoint`, no `transport` — exactly how the apps ship while the
    // backend has no collector route.
    const telemetry = initTelemetry({
      enabled: true,
      store,
      release: RELEASE,
      segmentation: () => ({
        route: '/',
        tenantId: null,
        locale: 'en',
        deviceClass: 'desktop',
        themeRevision: null,
      }),
      sources: [src.source],
    })

    expect(telemetry.isCollecting()).toBe(true)
    src.push({ kind: 'vital', name: 'LCP', value: 900, rating: 'good' })
    telemetry.flush()
    expect(fetchSpy).not.toHaveBeenCalled()
    telemetry.dispose()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('enabled with an endpoint but sampled out: no source starts, so nothing exists to send', () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const src = recordingSource()

    const telemetry = initTelemetry({
      enabled: true,
      endpoint: 'https://telemetry.example.test/collect',
      store,
      release: RELEASE,
      sampleRate: 0,
      segmentation: () => ({
        route: '/',
        tenantId: null,
        locale: 'en',
        deviceClass: 'desktop',
        themeRevision: null,
      }),
      sources: [src.source],
    })

    expect(telemetry.isCollecting()).toBe(false)
    src.push({ kind: 'vital', name: 'LCP', value: 900, rating: 'good' })
    telemetry.flush()
    expect(fetchSpy).not.toHaveBeenCalled()
    telemetry.dispose()
  })
})
