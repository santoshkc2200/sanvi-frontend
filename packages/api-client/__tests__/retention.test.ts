import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../src/client'
import { getRetentionReport, parseRetentionReport, RETENTION_REPORT_PATH } from '../src/retention'

function fakeClient(): { client: ApiClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({})
  return {
    request,
    client: {
      request,
      requestRaw: vi.fn().mockResolvedValue({ status: 200, body: {} }),
      requestStream: vi.fn().mockResolvedValue(new ReadableStream()),
      getLastTraceId: vi.fn(() => undefined),
      get: (path, options) => request(path, { ...options, method: 'GET' }),
      post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
      put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
      patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
      delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
    },
  }
}

// Shape mirrored from the backend's retention report serde structs
// (sanvi-backend `apps/cli/src/retention_report.rs`) — the same JSON the
// evidence packs consume.
const wire = {
  generated_at: '2026-10-14T00:00:00Z',
  staleness_window_hours: 48,
  classes: [
    {
      data_class: 'consent_record',
      sensitivity: 'sensitive',
      basis: 'consent',
      period_days: 1095,
      action: 'delete',
      enforcement: 'executor:privacy.retention_sweep',
      executor: 'privacy.retention_sweep',
      last_run: {
        run_at: '2026-10-13T22:00:00Z',
        action: 'delete',
        rows_affected: 12,
        executor: 'privacy.retention_sweep',
      },
      oldest_surviving_row: '2026-01-01T00:00:00Z',
      stalled: false,
    },
    {
      data_class: 'invoice',
      sensitivity: 'confidential',
      period_days: 3650,
      action: 'archive',
      enforcement: 'executor:platform.archival_sweep',
      last_run: {
        run_at: '2026-10-01T00:00:00Z',
        action: 'archive',
        rows_affected: 3,
        executor: 'platform.archival_sweep',
      },
      oldest_surviving_row: '2016-10-14T00:00:00Z',
      stalled: true,
    },
    {
      data_class: 'audit_log',
      sensitivity: 'confidential',
      period_days: 365,
      action: 'archive',
      enforcement: 'by-construction (append-only grants guarantee the >= 1 year minimum)',
    },
  ],
  stalled_classes: ['invoice'],
}

describe('parseRetentionReport', () => {
  it('parses the backend report into the typed shape', () => {
    const report = parseRetentionReport(wire)
    expect(report?.generatedAt).toBe('2026-10-14T00:00:00Z')
    expect(report?.stalenessWindowHours).toBe(48)
    expect(report?.classes).toHaveLength(3)
    expect(report?.classes[0]).toEqual({
      dataClass: 'consent_record',
      sensitivity: 'sensitive',
      basis: 'consent',
      periodDays: 1095,
      action: 'delete',
      enforcement: 'executor:privacy.retention_sweep',
      executor: 'privacy.retention_sweep',
      lastRun: {
        runAt: '2026-10-13T22:00:00Z',
        action: 'delete',
        rowsAffected: 12,
        executor: 'privacy.retention_sweep',
      },
      oldestSurvivingRow: '2026-01-01T00:00:00Z',
      stalled: false,
    })
    expect(report?.classes[1]?.stalled).toBe(true)
    // An executor-backed class with no recorded run is stalled by definition.
    expect(report?.classes[2]?.stalled).toBeUndefined()
    expect(report?.stalledClasses).toEqual(['invoice'])
  })

  it('derives stalled: true for an executor class that has never run', () => {
    const report = parseRetentionReport({
      generated_at: '2026-10-14T00:00:00Z',
      staleness_window_hours: 48,
      classes: [
        {
          data_class: 'advertising_metric',
          sensitivity: 'internal',
          period_days: 730,
          action: 'archive',
          enforcement: 'executor:platform.partition_maintenance',
        },
      ],
      stalled_classes: ['advertising_metric'],
    })
    expect(report?.classes[0]?.stalled).toBe(true)
  })

  it('drops malformed class rows rather than rendering them', () => {
    const report = parseRetentionReport({
      generated_at: '2026-10-14T00:00:00Z',
      staleness_window_hours: 48,
      classes: [
        { data_class: 'x' }, // no rule
        { data_class: '', period_days: 1, action: 'delete', enforcement: 'unenforced' },
        { data_class: 'ok', period_days: -5, action: 'delete', enforcement: 'unenforced' },
        {
          data_class: 'good',
          period_days: 30,
          action: 'delete',
          enforcement: 'unenforced',
          last_run: { run_at: 'nope' },
        },
      ],
      stalled_classes: 'not-a-list',
    })
    expect(report?.classes).toEqual([])
    expect(report?.stalledClasses).toEqual([])
  })

  it('returns undefined for garbage', () => {
    expect(parseRetentionReport(undefined)).toBeUndefined()
    expect(parseRetentionReport({})).toBeUndefined()
    expect(parseRetentionReport({ classes: 42, stalled_classes: [] })).toBeUndefined()
  })
})

describe('getRetentionReport', () => {
  it('GETs the retention report path through the raw client and parses', async () => {
    const { client, request } = fakeClient()
    request.mockResolvedValueOnce(wire)

    const report = await getRetentionReport(client)

    expect(request).toHaveBeenCalledWith(RETENTION_REPORT_PATH, { method: 'GET' })
    expect(report?.classes).toHaveLength(3)
  })
})
