import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@sanvi/api-client/problem'
import { ConsentStore } from '@sanvi/consent'
import type { DirectiveSnapshot, ProcessingPurpose } from '@sanvi/consent'
import {
  clearDiagnosticBreadcrumbs,
  recordDiagnosticBreadcrumb,
  recentBreadcrumbs,
} from '../diagnostics'
import { initErrorTracker } from '../errors'
import type { ErrorReport } from '../errors'
import type { ReleaseStamp, TelemetrySegmentation } from '../types'

/**
 * The FR-1104 error tracker: release-tagged, scrubbed before send, and
 * directive-gated with the collector's own suppression semantics. The gate
 * fixtures mirror `directive-gate.test.ts` — same snapshot shape, same
 * EU-deny / US-allow defaults.
 */
function snapshot(us = false, analyticsState?: 'allowed' | 'denied'): DirectiveSnapshot {
  const jurisdiction = us ? 'us-ca' : 'eu'
  const purposes: ProcessingPurpose[] = ['analytics']
  return {
    subject: { key: 'subject-1', kind: 'device', identifiers: [] },
    jurisdiction,
    directives: purposes.map((purpose) => ({
      purpose,
      state: purpose === 'analytics' && analyticsState ? analyticsState : us ? 'allowed' : 'denied',
      source: 'default',
      effective_at: '2026-01-01T00:00:00Z',
      jurisdiction,
      notice_version: '2026.1',
    })),
    honours_universal_opt_out: true,
  }
}

const RELEASE: ReleaseStamp = {
  commit: 'e2eb1d9f0012',
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

beforeEach(() => {
  clearDiagnosticBreadcrumbs()
})

describe('initErrorTracker', () => {
  it('sends a scrubbed, release-tagged report when the gate is open', () => {
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const send = vi.fn()
    const tracker = initErrorTracker({
      enabled: true,
      store,
      release: RELEASE,
      segmentation: () => ({ ...SEGMENTATION }),
      getTraceId: () => 'trace-fallback',
      transport: send,
      now: () => 1_700_000_000_000,
    })

    tracker.captureError(new Error('Contact user@example.test about it'))

    expect(send).toHaveBeenCalledTimes(1)
    const report = send.mock.calls[0]?.[0] as ErrorReport
    expect(report.message).toBe('Contact [removed-email] about it')
    expect(report.name).toBe('Error')
    expect(report.release).toEqual(RELEASE)
    expect(report.segmentation).toEqual(SEGMENTATION)
    expect(report.traceId).toBe('trace-fallback')
    expect(report.timestamp).toBe(1_700_000_000_000)
    tracker.dispose()
  })

  it('prefers the ApiError problem trace_id, and carries the API status', () => {
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const send = vi.fn()
    const tracker = initErrorTracker({
      enabled: true,
      store,
      release: RELEASE,
      segmentation: () => ({ ...SEGMENTATION }),
      getTraceId: () => 'trace-fallback',
      transport: send,
    })

    const apiError = new ApiError(
      503,
      { type: 'about:blank', title: 'Degraded', status: 503, trace_id: 'trace-from-problem' },
      'req-1',
    )
    tracker.captureError(apiError, { traceId: undefined })

    const report = send.mock.calls[0]?.[0] as ErrorReport
    expect(report.status).toBe(503)
    expect(report.traceId).toBe('trace-from-problem')
    tracker.dispose()
  })

  it('honours an explicit context trace id over every fallback', () => {
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const send = vi.fn()
    const tracker = initErrorTracker({
      enabled: true,
      store,
      release: RELEASE,
      segmentation: () => ({ ...SEGMENTATION }),
      getTraceId: () => 'trace-fallback',
      transport: send,
    })

    tracker.captureError(new ApiError(500, { type: 'about:blank', title: 'x', status: 500 }, 'r'), {
      traceId: 'trace-explicit',
    })

    const report = send.mock.calls[0]?.[0] as ErrorReport
    expect(report.traceId).toBe('trace-explicit')
    tracker.dispose()
  })

  it('includes the shared breadcrumbs in the report', () => {
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const send = vi.fn()
    const tracker = initErrorTracker({
      enabled: true,
      store,
      release: RELEASE,
      segmentation: () => ({ ...SEGMENTATION }),
      transport: send,
    })

    recordDiagnosticBreadcrumb('navigation', '/products/[id]')
    tracker.captureError(new Error('boom'))

    const report = send.mock.calls[0]?.[0] as ErrorReport
    expect(report.breadcrumbs.map((crumb) => crumb.message)).toContain('/products/[id]')
    // And the error itself is now a crumb for any later paste.
    expect(recentBreadcrumbs().some((crumb) => crumb.category === 'error')).toBe(true)
    tracker.dispose()
  })

  it('EU opt-in denial: nothing is sent — but the error is still a breadcrumb for the paste', () => {
    const store = new ConsentStore({ snapshot: snapshot(false), consentModel: 'opt_in' })
    const send = vi.fn()
    const tracker = initErrorTracker({
      enabled: true,
      store,
      release: RELEASE,
      segmentation: () => ({ ...SEGMENTATION }),
      transport: send,
    })

    tracker.captureError(new Error('boom'))

    expect(send).not.toHaveBeenCalled()
    expect(tracker.isCapturing()).toBe(false)
    expect(tracker.droppedCount()).toBe(1)
    expect(recentBreadcrumbs().some((crumb) => crumb.category === 'error')).toBe(true)
    tracker.dispose()
  })

  it('no consent store wired: suppressed (deny-all), like the collector', () => {
    const send = vi.fn()
    const tracker = initErrorTracker({
      enabled: true,
      store: null,
      release: RELEASE,
      segmentation: () => ({ ...SEGMENTATION }),
      transport: send,
    })

    tracker.captureError(new Error('boom'))
    expect(send).not.toHaveBeenCalled()
    tracker.dispose()
  })

  it('revocation mid-session drops the next report — nothing queues for later', () => {
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const send = vi.fn()
    const tracker = initErrorTracker({
      enabled: true,
      store,
      release: RELEASE,
      segmentation: () => ({ ...SEGMENTATION }),
      transport: send,
    })

    tracker.captureError(new Error('before'))
    expect(send).toHaveBeenCalledTimes(1)

    store.setDecision('analytics', false)
    tracker.captureError(new Error('after'))
    expect(send).toHaveBeenCalledTimes(1)
    expect(tracker.droppedCount()).toBe(1)
    tracker.dispose()
  })

  it('disabled: a tracker that cannot capture at all', () => {
    const send = vi.fn()
    const tracker = initErrorTracker({
      enabled: false,
      store: new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' }),
      release: RELEASE,
      segmentation: () => ({ ...SEGMENTATION }),
      transport: send,
    })

    tracker.captureError(new Error('boom'))
    expect(send).not.toHaveBeenCalled()
    expect(tracker.isCapturing()).toBe(false)
    expect(tracker.droppedCount()).toBe(0)
  })

  it('stack traces are scrubbed and capped', () => {
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const send = vi.fn()
    const tracker = initErrorTracker({
      enabled: true,
      store,
      release: RELEASE,
      segmentation: () => ({ ...SEGMENTATION }),
      transport: send,
    })

    const error = new Error('token leaked: session_token=abc123def456')
    error.stack = `Error: token leaked\n    at at ${'x'.repeat(4096)}`
    tracker.captureError(error)

    const report = send.mock.calls[0]?.[0] as ErrorReport
    expect(report.message).toContain('[removed-secret]')
    expect(report.stack!.length).toBeLessThanOrEqual(2048)
    tracker.dispose()
  })
})
