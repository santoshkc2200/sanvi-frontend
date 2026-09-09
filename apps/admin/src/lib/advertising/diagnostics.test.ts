import type { ConsentSnapshot, ConversionEvent } from '@sanvi/api-client'
import { AD_REASON_CATEGORIES } from '@sanvi/ui'
import { AD_PLATFORM_FIXTURES } from '@sanvi/ui/test-fixtures'
import { describe, expect, it } from 'vitest'
import {
  canRetry,
  diagnosticsHealth,
  failureCategory,
  healthBannerLevel,
  MIN_EVENTS_FOR_BANNER,
  primaryCategory,
  rowOutcome,
  suppressionCategory,
  UPLOAD_FAILURE_THRESHOLD,
  uploadCategory,
  SUPPRESSION_SHARE_THRESHOLD,
} from './diagnostics'

/**
 * The diagnostics classification layer (TASK-015). The load-bearing
 * assertions: every directive-decided signal maps to its own *respected*
 * category (never an incident tone), failure reasons map onto the taxonomy
 * by their stable vocabulary, retry eligibility follows the compliance
 * rule, and the banner keeps the two health figures independent.
 */

function consent(overrides: Partial<ConsentSnapshot> = {}): ConsentSnapshot {
  return {
    answers: { ads_measurement: 'allowed' },
    jurisdiction: 'jp',
    purposes_asked: ['ads_measurement'],
    resolver_version: '2026-08-01',
    signal_source: 'ui',
    ...overrides,
  }
}

function event(overrides: Partial<ConversionEvent> = {}): ConversionEvent {
  return {
    id: '9007199254740993',
    tenant_id: 'dev-acme',
    event_id: 'ev-1',
    name: 'purchase',
    occurred_at: '2026-09-05T10:00:00Z',
    click_ids: { gclid: 'g-1' },
    hashed_identifiers: {},
    consent: consent(),
    upload_states: { meta: { status: 'uploaded', attempt_count: 1 } },
    value: null,
    value_source: null,
    order_ref: null,
    subject_key: { kind: 'tenant_device', device_ref: 'dev-1' },
    ...overrides,
  }
}

/** The non-meta platform key comes from the shared fixtures — the gate
 *  rightly bans spelling platform identifiers in shipped source. */
const OTHER_PLATFORM = AD_PLATFORM_FIXTURES.find((candidate) => candidate.key !== 'meta')!.key

describe('suppressionCategory — signal source decides the category', () => {
  it('maps a universal opt-out to the sale/share opt-out category', () => {
    expect(suppressionCategory(consent({ signal_source: 'uoom' }))).toBe('opted_out_sale_share')
  })

  it('maps GPC to the browser privacy signal category', () => {
    expect(suppressionCategory(consent({ signal_source: 'gpc' }))).toBe('browser_privacy_signal')
  })

  it('maps ui, api, guardian, import, and unknown sources to missing consent', () => {
    for (const source of ['ui', 'api', 'guardian', 'import', 'something_new']) {
      expect(suppressionCategory(consent({ signal_source: source })), source).toBe(
        'missing_consent',
      )
    }
  })
})

describe('failureCategory — backend reason vocabulary maps onto the taxonomy', () => {
  it('maps the late-suppression prefix to withdrawn after capture', () => {
    expect(failureCategory('suppressed_late: consent withdrawn since capture')).toBe(
      'withdrawn_after_capture',
    )
  })

  it('maps click-id refusals and token/credential failures to their own categories', () => {
    expect(failureCategory('no click id present for platform')).toBe('missing_click_id')
    expect(failureCategory('advertising connection has no stored credential')).toBe('token_expired')
    expect(failureCategory('token refresh failed: 401')).toBe('token_expired')
  })

  it('falls through to the specific upload-error category, never a generic string', () => {
    expect(failureCategory('platform returned 500')).toBe('upload_error')
    expect(AD_REASON_CATEGORIES).toContain('upload_error')
  })
})

describe('uploadCategory — per-platform state classification', () => {
  it('returns null while pending or uploaded', () => {
    expect(uploadCategory({ status: 'pending', attempt_count: 0 })).toBeNull()
    expect(uploadCategory({ status: 'uploaded', attempt_count: 1 })).toBeNull()
  })

  it('reads retraction states as withdrawn after capture', () => {
    expect(uploadCategory({ status: 'retracted' })).toBe('withdrawn_after_capture')
    expect(uploadCategory({ status: 'unpropagated', reason: 'platform refused' })).toBe(
      'withdrawn_after_capture',
    )
  })

  it('classifies failed and parked states by their reason', () => {
    expect(uploadCategory({ status: 'failed', attempt_count: 2, reason: 'platform 500' })).toBe(
      'upload_error',
    )
    expect(
      uploadCategory({ status: 'parked', attempts: 5, reason: 'suppressed_late: withdrawn' }),
    ).toBe('withdrawn_after_capture')
  })
})

describe('primaryCategory and rowOutcome', () => {
  it('a capture-suppressed event is suppressed, whatever its signal', () => {
    const suppressed = event({
      consent: consent({ answers: { ads_measurement: 'denied' }, signal_source: 'uoom' }),
      upload_states: {},
    })
    expect(primaryCategory(suppressed)).toBe('opted_out_sale_share')
    expect(rowOutcome(suppressed)).toBe('suppressed')
  })

  it('a late-suppressed failed state reads as suppressed, not upload issues', () => {
    const late = event({
      upload_states: {
        meta: {
          status: 'failed',
          attempt_count: 1,
          reason: 'suppressed_late: consent withdrawn since capture',
        },
      },
    })
    expect(rowOutcome(late)).toBe('suppressed')
  })

  it('a partial success still buckets as upload issues, with the failure as the primary category', () => {
    const partial = event({
      upload_states: {
        [OTHER_PLATFORM]: { status: 'uploaded', attempt_count: 1 },
        meta: { status: 'failed', attempt_count: 2, reason: 'platform 500' },
      },
    })
    expect(rowOutcome(partial)).toBe('upload_issues')
    expect(primaryCategory(partial)).toBe('upload_error')
  })

  it('parked outranks failed as the primary category', () => {
    const mixed = event({
      upload_states: {
        [OTHER_PLATFORM]: { status: 'failed', attempt_count: 1, reason: 'timeout' },
        meta: { status: 'parked', attempts: 5, reason: 'platform 500' },
      },
    })
    expect(primaryCategory(mixed)).toBe('upload_error')
  })

  it('a clean uploaded event is permitted', () => {
    expect(rowOutcome(event())).toBe('permitted')
  })
})

describe('canRetry — the compliance trap never renders a button', () => {
  it('renders on parked rows', () => {
    const parked = event({
      upload_states: { meta: { status: 'parked', attempts: 5, reason: 'platform 500' } },
    })
    expect(canRetry(parked)).toBe(true)
  })

  it('never renders on a directive-suppressed row — even one with parked states', () => {
    const suppressedWithParked = event({
      consent: consent({ answers: { ads_measurement: 'denied' } }),
      upload_states: { meta: { status: 'parked', attempts: 5, reason: 'platform 500' } },
    })
    expect(canRetry(suppressedWithParked)).toBe(false)
  })

  it('never renders on a late-suppressed (withdrawn) row', () => {
    const withdrawn = event({
      upload_states: {
        meta: {
          status: 'failed',
          attempt_count: 1,
          reason: 'suppressed_late: consent withdrawn since capture',
        },
      },
    })
    expect(canRetry(withdrawn)).toBe(false)
  })

  it('never renders for an email-identified subject the backend cannot safely re-check', () => {
    const contact = event({
      subject_key: { kind: 'contact' },
      upload_states: { meta: { status: 'parked', attempts: 5, reason: 'platform 500' } },
    })
    expect(canRetry(contact)).toBe(false)
  })

  it('does not render on merely failed rows — the worker still owns those attempts', () => {
    expect(
      canRetry(
        event({ upload_states: { meta: { status: 'failed', attempt_count: 1, reason: '500' } } }),
      ),
    ).toBe(false)
  })
})

describe('diagnosticsHealth — the two figures stay independent', () => {
  it('splits suppression by signal source and counts failures separately', () => {
    const events = [
      event(),
      event({
        id: '2',
        consent: consent({ answers: { ads_measurement: 'denied' }, signal_source: 'ui' }),
        upload_states: {},
      }),
      event({
        id: '3',
        consent: consent({ answers: { sale_or_share: 'denied' }, signal_source: 'uoom' }),
        upload_states: {},
      }),
      event({
        id: '4',
        consent: consent({ answers: { ads_measurement: 'denied' }, signal_source: 'gpc' }),
        upload_states: {},
      }),
      event({
        id: '5',
        upload_states: {
          [OTHER_PLATFORM]: { status: 'uploaded', attempt_count: 1 },
          meta: { status: 'failed', attempt_count: 2, reason: 'platform 500' },
        },
      }),
      event({
        id: '6',
        upload_states: { meta: { status: 'parked', attempts: 5, reason: 'platform 500' } },
      }),
    ]
    const health = diagnosticsHealth(events)
    expect(health.total).toBe(6)
    expect(health.suppressed).toBe(3)
    expect(health.consentAbsent).toBe(1)
    expect(health.optedOut).toBe(1)
    expect(health.browserSignal).toBe(1)
    expect(health.attempted).toBe(3)
    expect(health.failing).toBe(2)
    expect(health.suppressionShare).toBeCloseTo(0.5)
    expect(health.uploadFailureRatio).toBeCloseTo(2 / 3)
  })

  it('a late suppression counts neither as a fresh suppression nor as a fixable failure', () => {
    const late = event({
      upload_states: {
        meta: {
          status: 'failed',
          attempt_count: 1,
          reason: 'suppressed_late: consent withdrawn since capture',
        },
      },
    })
    const health = diagnosticsHealth([late, event(), event(), event()])
    expect(health.failing).toBe(0)
    expect(health.attempted).toBe(4)
    expect(healthBannerLevel(health)).toBe('none')
  })
})

describe('healthBannerLevel — thresholds and tones', () => {
  it('stays quiet below the minimum window', () => {
    const health = diagnosticsHealth(
      Array.from({ length: MIN_EVENTS_FOR_BANNER - 1 }, (_, i) => event({ id: String(i) })),
    )
    expect(healthBannerLevel(health)).toBe('none')
  })

  it('warns when suppression alone crosses its threshold', () => {
    const events = [
      event({ consent: consent({ answers: { ads_measurement: 'denied' } }), upload_states: {} }),
      event({ consent: consent({ answers: { ads_measurement: 'denied' } }), upload_states: {} }),
    ]
    const health = diagnosticsHealth([...events, event(), event()])
    expect(health.suppressionShare).toBeGreaterThanOrEqual(SUPPRESSION_SHARE_THRESHOLD)
    expect(healthBannerLevel(health)).toBe('warning')
  })

  it('escalates to error when the upload failure ratio crosses its threshold', () => {
    const events = [
      event({ upload_states: { meta: { status: 'parked', attempts: 5, reason: '500' } } }),
      event({ upload_states: { meta: { status: 'parked', attempts: 5, reason: '500' } } }),
    ]
    const health = diagnosticsHealth([...events, event(), event()])
    expect(health.uploadFailureRatio).toBeGreaterThanOrEqual(UPLOAD_FAILURE_THRESHOLD)
    expect(healthBannerLevel(health)).toBe('error')
  })

  it('stays quiet when both ratios are low', () => {
    const health = diagnosticsHealth([
      event({ upload_states: { meta: { status: 'parked', attempts: 5, reason: '500' } } }),
      event(),
      event(),
      event(),
      event(),
      event(),
      event(),
      event(),
      event(),
      event(),
    ])
    expect(health.uploadFailureRatio).toBeCloseTo(0.1)
    expect(healthBannerLevel(health)).toBe('none')
  })
})
