import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../src/client'
import { createTypedApiClient } from '../src/typed'
import { getOffboarding, purgeReportOf, requestOffboarding } from '../src/offboarding'

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

const snapshot = {
  id: '873698342314721281',
  tenant_id: '873698342314721280',
  idempotency_key: '2026-10-acme-exit',
  status: 'exported',
  export: { path: '/var/lib/sanvi/exports/offboarding/x.zip.sealed', checksum: 'sha256:abc' },
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-02T00:00:00Z',
}

describe('offboarding api functions', () => {
  it('requestOffboarding POSTs the idempotency key to the tenant offboarding path', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)
    request.mockResolvedValueOnce(snapshot)

    await requestOffboarding(typed, '873698342314721280', { idempotencyKey: '2026-10-acme-exit' })

    expect(request).toHaveBeenCalledWith(
      '/api/v1/platform/tenants/873698342314721280/offboarding',
      {
        method: 'POST',
        body: { idempotency_key: '2026-10-acme-exit' },
      },
    )
  })

  it('getOffboarding GETs the tenant offboarding path', async () => {
    const { client, request } = fakeClient()
    const typed = createTypedApiClient(client)
    request.mockResolvedValueOnce(snapshot)

    await getOffboarding(typed, '873698342314721280')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/platform/tenants/873698342314721280/offboarding',
      {
        method: 'GET',
      },
    )
  })
})

// The purge report arrives as a schema-less JSON member the operator CLI
// wrote (sanvi-backend `apps/cli/src/offboard.rs`). The parser is the
// contract: a surface renders only what validated, and malformed members
// are dropped — never leaked into the DOM, never a crash.
describe('purgeReportOf', () => {
  const wire = {
    tenant: 'acme',
    tenant_id: '873698342314721280',
    request_id: '873698342314721282',
    removed: { 'billing.invoices': 12, 'advertising.metrics_daily': 400 },
    lawfully_retained: [
      {
        data_class: 'invoice',
        table: 'billing.invoices',
        rows_retained: 5,
        legal_basis: 'statutory retention window (privacy.retention_rules)',
        retention_end: '2027-10-11T00:00:00+00:00',
      },
      {
        data_class: 'audit_log',
        table: 'audit.entries',
        rows_retained: 210,
        legal_basis: 'append-only chain',
        retention_end: null,
      },
    ],
    retained_assertion: 'retained classes carry reason and retention end date',
    archives_purged: 2,
    cache_keys_deleted: 7,
    backup_policy_note: 'backups expire on their existing schedule (35 days)',
    object_storage_note: 'media bytes live in hitox-media-service',
    search_indexes_note: 'no search infrastructure beyond Postgres full-text',
    neighbour: { tenant: 'other', byte_identical: true },
    residual_scan: 'clean',
  }

  it('parses the operator CLI report into the typed shape', () => {
    const report = purgeReportOf(wire)
    expect(report).toEqual({
      tenant: 'acme',
      tenantId: '873698342314721280',
      requestId: '873698342314721282',
      removed: { 'billing.invoices': 12, 'advertising.metrics_daily': 400 },
      lawfullyRetained: [
        {
          dataClass: 'invoice',
          table: 'billing.invoices',
          rowsRetained: 5,
          legalBasis: 'statutory retention window (privacy.retention_rules)',
          retentionEnd: '2027-10-11T00:00:00+00:00',
        },
        {
          dataClass: 'audit_log',
          table: 'audit.entries',
          rowsRetained: 210,
          legalBasis: 'append-only chain',
          retentionEnd: undefined,
        },
      ],
      archivesPurged: 2,
      cacheKeysDeleted: 7,
      backupPolicyNote: 'backups expire on their existing schedule (35 days)',
      objectStorageNote: 'media bytes live in hitox-media-service',
      searchIndexesNote: 'no search infrastructure beyond Postgres full-text',
      neighbour: { tenant: 'other', byteIdentical: true },
      residualScan: 'clean',
    })
  })

  it('drops malformed retained entries rather than rendering them', () => {
    const report = purgeReportOf({
      ...wire,
      lawfully_retained: [
        { data_class: 'invoice', rows_retained: 5 }, // no table, no legal basis
        { data_class: '', table: 'x.y', rows_retained: 1, legal_basis: 'b', retention_end: null },
        { data_class: 'audit_log', table: 'a.e', rows_retained: -3, legal_basis: 'b' },
        {
          data_class: 'invoice',
          table: 'b.i',
          rows_retained: 2,
          legal_basis: 'ok',
          retention_end: 42,
        },
      ],
    })
    expect(report?.lawfullyRetained).toEqual([])
  })

  it('drops non-numeric removed counts and non-string notes', () => {
    const report = purgeReportOf({
      ...wire,
      removed: { 'good.table': 3, 'bad.table': 'many', 'worse.table': -1 },
      backup_policy_note: 42,
    })
    expect(report?.removed).toEqual({ 'good.table': 3 })
    expect(report?.backupPolicyNote).toBeUndefined()
  })

  it('returns undefined for garbage — the surface then says the report is unavailable', () => {
    expect(purgeReportOf(undefined)).toBeUndefined()
    expect(purgeReportOf('nope')).toBeUndefined()
    expect(purgeReportOf({})).toBeUndefined()
  })

  it('is deterministic — re-rendering the same stored report produces the same value', () => {
    expect(purgeReportOf(wire)).toEqual(purgeReportOf(wire))
  })
})
