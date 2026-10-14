import { axe } from '@sanvi/test-config/axe'
import { cleanup, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Audit from '../src/routes/Audit.svelte'

/**
 * The audit page (TASK-028): an unfiltered audit read refuses with 409
 * `archived-range` whenever archived ranges overlap the window, so the page
 * must render the archived state — naming the restore path — and never read
 * as "no audit activity". Fetch is stubbed at the HTTP boundary.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function problemResponse(status: number, reason?: string): Response {
  return new Response(
    JSON.stringify({
      type: 'https://sanvi.app/problems/conflict',
      title: 'Conflict',
      status,
      detail: 'the requested window overlaps archived storage',
      ...(reason ? { reason } : {}),
    }),
    { status, headers: { 'content-type': 'application/problem+json' } },
  )
}

const ENTRY = {
  id: 'entry-1',
  seq: 1,
  occurred_at: '2026-10-01T00:00:00Z',
  actor_type: 'user',
  actor_id: 'usr_1',
  action: 'tenancy.suspend',
  resource_type: 'tenant',
  resource_id: 'tenant-123',
  tenant_id: 'tenant-123',
  before: null,
  after: { reason: 'abuse' },
}

function setupFetch(handlers: {
  audit?: unknown
  problem?: { status: number; reason?: string }
}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/v1/platform/audit')) {
      if (handlers.problem) return problemResponse(handlers.problem.status, handlers.problem.reason)
      return jsonResponse(handlers.audit ?? { entries: [], next_cursor: null })
    }
    if (url.includes('/api/v1/me'))
      return jsonResponse({ user_id: 'usr_1', roles: ['platform.operator'] })
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

describe('Audit archived-range state (TASK-028)', () => {
  it('renders the archived state naming the restore path — never as an empty list', async () => {
    setupFetch({ problem: { status: 409, reason: 'archived-range' } })
    render(Audit)

    expect(await screen.findByText('This window is archived')).toBeInTheDocument()
    expect(document.querySelector('[data-archived="range"]')).not.toBeNull()
    // The restore path is named in the copy.
    expect(screen.getByText(/archive-restore/)).toBeInTheDocument()
    // Never the empty-list copy, and no spinner left behind.
    expect(screen.queryByText(/no audit entries/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('renders entries when the window is live — the state is data-driven', async () => {
    setupFetch({ audit: { entries: [ENTRY], next_cursor: null } })
    render(Audit)

    expect(await screen.findByText('tenancy.suspend')).toBeInTheDocument()
    expect(document.querySelector('[data-archived="range"]')).toBeNull()
  })

  it('has no axe violations in the archived state', async () => {
    setupFetch({ problem: { status: 409, reason: 'archived-range' } })
    const { container } = render(Audit)
    await screen.findByText('This window is archived')
    expect(await axe(container)).toHaveNoViolations()
  })
})
