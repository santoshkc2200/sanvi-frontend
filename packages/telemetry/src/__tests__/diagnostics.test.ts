import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@sanvi/api-client/problem'
import {
  buildDiagnosticsPaste,
  clearDiagnosticBreadcrumbs,
  errorTraceId,
  recentBreadcrumbs,
  recordDiagnosticBreadcrumb,
} from '../diagnostics'

const RELEASE = {
  commit: 'e2eb1d9f0012',
  version: '0.1.0',
  built_at: '2026-01-01T00:00:00Z',
  environment: 'local',
}

beforeEach(() => {
  clearDiagnosticBreadcrumbs()
})

describe('the shared breadcrumb buffer', () => {
  it('keeps the last few crumbs, oldest first', () => {
    for (let index = 0; index < 15; index += 1) {
      recordDiagnosticBreadcrumb('navigation', `/route-${index}`)
    }
    const crumbs = recentBreadcrumbs()
    expect(crumbs).toHaveLength(10)
    expect(crumbs[0]?.message).toBe('/route-5')
    expect(crumbs[9]?.message).toBe('/route-14')
  })

  it('scrubs crumbs at record time — an email, a bearer token, or a query string never enters the buffer', () => {
    recordDiagnosticBreadcrumb('api', 'GET /v1/x?email=user@example.test&token=abc123def456')
    recordDiagnosticBreadcrumb(
      'error',
      'Contact support@example.test or bearer eyJhbGciOiJIUzI1NiIs',
    )
    const serialized = JSON.stringify(recentBreadcrumbs())
    expect(serialized).not.toContain('@')
    expect(serialized).not.toContain('eyJ')
    expect(serialized).not.toContain('?')
  })

  it('returns a copy — mutating the snapshot cannot corrupt the buffer', () => {
    recordDiagnosticBreadcrumb('navigation', '/x')
    recentBreadcrumbs().length = 0
    expect(recentBreadcrumbs()).toHaveLength(1)
  })
})

describe('errorTraceId', () => {
  it('reads the trace id from an ApiError', () => {
    const error = new ApiError(
      500,
      { type: 'about:blank', title: 'Boom', status: 500, trace_id: 'trace-abc' },
      'req-1',
    )
    expect(errorTraceId(error)).toBe('trace-abc')
  })

  it('is undefined for anything that is not an ApiError', () => {
    expect(errorTraceId(new Error('boom'))).toBeUndefined()
    expect(errorTraceId('a string')).toBeUndefined()
    expect(errorTraceId(undefined)).toBeUndefined()
  })
})

describe('buildDiagnosticsPaste', () => {
  it('renders all six FR-1106 sections in a stable order', () => {
    recordDiagnosticBreadcrumb('navigation', '/products/[id]')
    const paste = buildDiagnosticsPaste({
      release: RELEASE,
      route: '/products/[id]',
      tenantId: '11111111-1111-1111-1111-111111111111',
      locale: 'ja',
      traceId: 'trace-abc',
      breadcrumbs: recentBreadcrumbs(),
    })

    const lines = paste.split('\n')
    expect(lines[0]).toBe('Sanvi diagnostics')
    expect(paste).toMatch(/^release: e2eb1d9f0012 v0\.1\.0 \(built 2026-01-01T00:00:00Z, local\)$/m)
    expect(paste).toMatch(/^route: \/products\/\[id\]$/m)
    expect(paste).toMatch(/^tenant: 11111111-1111-1111-1111-111111111111$/m)
    expect(paste).toMatch(/^locale: ja$/m)
    expect(paste).toMatch(/^trace_id: trace-abc$/m)
    expect(paste).toMatch(/^breadcrumbs:$/m)
    expect(paste).toContain('/products/[id]')
    expect(lines).toHaveLength(8)
  })

  it('states absence honestly — every section is present even when a value is missing', () => {
    const paste = buildDiagnosticsPaste({
      release: RELEASE,
      route: '/x',
      tenantId: null,
      locale: 'en',
      traceId: null,
    })
    expect(paste).toMatch(/^tenant: none$/m)
    expect(paste).toMatch(/^trace_id: none$/m)
    expect(paste).toMatch(/^ {2}\(none recorded\)$/m)
  })
})
