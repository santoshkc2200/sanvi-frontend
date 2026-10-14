import { axe } from '@sanvi/test-config/axe'
import { cleanup, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Retention from '../src/routes/Retention.svelte'

/**
 * The retention surface (TASK-028): every class with rule, last run, rows
 * affected, and oldest surviving row, from the backend's live report, with a
 * stalled class visibly flagged. The report endpoint is a recorded
 * cross-repo gap — until the backend lands it, the page says so honestly
 * instead of rendering an empty table.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const REPORT = {
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
        run_at: '2026-09-01T00:00:00Z',
        action: 'archive',
        rows_affected: 3,
        executor: 'platform.archival_sweep',
      },
      oldest_surviving_row: '2016-10-14T00:00:00Z',
      stalled: true,
    },
  ],
  stalled_classes: ['invoice'],
}

function setupFetch(handlers: { report?: unknown; status?: number }): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/platform/privacy/retention/report')) {
      return jsonResponse(handlers.report ?? {}, handlers.status ?? 200)
    }
    if (url.includes('/api/v1/me')) return jsonResponse({ user_id: 'usr_1', roles: [] })
    return jsonResponse({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('Retention surface (TASK-028)', () => {
  it('renders the per-class report with a stalled class visibly flagged', async () => {
    setupFetch({ report: REPORT })
    render(Retention)

    expect(await screen.findByText('consent_record')).toBeInTheDocument()
    expect(screen.getAllByText('invoice').length).toBeGreaterThan(0)
    // The stalled class is flagged — banner + marker, not colour alone.
    expect(document.querySelector('[data-retention="stalled"]')).not.toBeNull()
    expect(screen.getByText(/staleness window missed/i)).toBeInTheDocument()
  })

  it('the report endpoint being absent renders the honest gap state — never an empty table', async () => {
    setupFetch({ status: 404 })
    render(Retention)

    expect(await screen.findByText(/not exposed by this backend build/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('has no axe violations with a stalled class flagged', async () => {
    setupFetch({ report: REPORT })
    const { container } = render(Retention)
    await screen.findByText('consent_record')
    expect(await axe(container)).toHaveNoViolations()
  })
})
