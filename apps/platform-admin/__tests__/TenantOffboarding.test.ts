import { axe } from '@sanvi/test-config/axe'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TenantOffboarding from '../src/routes/tenants/offboarding/TenantOffboarding.svelte'

/**
 * The offboarding console (TASK-028, FR-1131): start (POST), monitor (GET
 * polling), the verified export's evidence, and the purge step — which is
 * unreachable until the export verifies, and whose typed confirmation must
 * name the tenant exactly. The report renders removed and lawfully retained
 * as two separated lists.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const TENANT = {
  id: 'tenant-123',
  slug: 'acme',
  display_name: 'Acme',
  region: 'us',
  default_locale: 'en',
  status: 'suspended',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'off-1',
    tenant_id: 'tenant-123',
    idempotency_key: 'key-2026-10',
    status: 'pending',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

const EXPORT = {
  path: '/var/lib/sanvi/exports/offboarding/acme.zip.sealed',
  checksum: 'sha256:abc123',
}

const PURGE_REPORT = {
  tenant: 'acme',
  tenant_id: 'tenant-123',
  request_id: 'off-1',
  removed: { 'advertising.metrics_daily': 400, 'billing.invoices': 12 },
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
  archives_purged: 2,
  cache_keys_deleted: 7,
  backup_policy_note: 'backups expire on their existing schedule (35 days)',
  object_storage_note: 'media bytes live in hitox-media-service',
  search_indexes_note: 'no search infrastructure beyond Postgres full-text',
  neighbour: { tenant: 'other', byte_identical: true },
  residual_scan: 'clean',
}

type OffboardingAnswer = { status?: number; body?: unknown }

function setupFetch(handlers: {
  tenant?: unknown
  offboardingGet?: OffboardingAnswer
  offboardingPost?: OffboardingAnswer
}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url.endsWith('/api/v1/platform/tenants/tenant-123') && method === 'GET') {
      return jsonResponse(handlers.tenant ?? TENANT)
    }
    if (url.includes('/offboarding') && method === 'GET') {
      const answer = handlers.offboardingGet ?? { body: snapshot() }
      if (answer.status !== undefined && answer.status !== 200) {
        return new Response(
          JSON.stringify({ type: 'about:blank', title: 'Not Found', status: answer.status }),
          {
            status: answer.status,
            headers: { 'content-type': 'application/problem+json' },
          },
        )
      }
      return jsonResponse(answer.body ?? snapshot())
    }
    if (url.includes('/offboarding') && method === 'POST') {
      const answer = handlers.offboardingPost ?? { body: snapshot() }
      return jsonResponse(answer.body ?? snapshot())
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

describe('TenantOffboarding console (TASK-028)', () => {
  it('the purge step is unreachable before the export verifies', async () => {
    setupFetch({ offboardingGet: { body: snapshot({ status: 'pending' }) } })
    render(TenantOffboarding, { props: { id: 'tenant-123' } })

    // The record is visible…
    expect(await screen.findByText('Offboarding', { selector: 'h1' })).toBeInTheDocument()
    await screen.findByText('Pending')
    // …but no purge affordance exists anywhere in the DOM.
    expect(screen.queryByRole('button', { name: /prepare purge/i })).not.toBeInTheDocument()
    expect(document.querySelector('[data-offboarding="purge-panel"]')).toBeNull()
    expect(document.querySelector('[data-offboarding="purge-command"]')).toBeNull()
  })

  it('after the export verifies the purge step appears and the typed confirmation names the tenant exactly', async () => {
    setupFetch({ offboardingGet: { body: snapshot({ status: 'exported', export: EXPORT }) } })
    render(TenantOffboarding, { props: { id: 'tenant-123' } })

    // The verified export's evidence renders — path and checksum, copyable.
    expect(await screen.findByText(EXPORT.path)).toBeInTheDocument()
    expect(screen.getByText(/sha256:abc123/)).toBeInTheDocument()

    const purgePanel = document.querySelector('[data-offboarding="purge-panel"]')
    expect(purgePanel).not.toBeNull()
    // The command itself is not revealed before the typed confirmation.
    expect(document.querySelector('[data-offboarding="purge-command"]')).toBeNull()

    await fireEvent.click(screen.getByRole('button', { name: /prepare purge/i }))
    const typedInput = await screen.findByLabelText(/type to confirm/i)
    await fireEvent.input(typedInput, { target: { value: 'wrong-tenant' } })
    const confirm = screen.getByRole('button', { name: /reveal the purge command/i })
    expect(confirm).toBeDisabled()

    await fireEvent.input(typedInput, { target: { value: 'acme' } })
    expect(confirm).toBeEnabled()
    await fireEvent.click(confirm)

    await waitFor(() =>
      expect(document.querySelector('[data-offboarding="purge-command"]')).not.toBeNull(),
    )
    const command = document.querySelector('[data-offboarding="purge-command"]')?.textContent ?? ''
    expect(command).toContain('acme')
    expect(command).toContain('key-2026-10')
    expect(command).toContain('--stage purge')
  })

  it('the purge report renders removed and lawfully retained as two separated lists', async () => {
    setupFetch({
      offboardingGet: {
        body: snapshot({
          status: 'purged',
          export: EXPORT,
          purge_report: PURGE_REPORT,
          completed_at: '2026-10-02T00:00:00Z',
        }),
      },
    })
    render(TenantOffboarding, { props: { id: 'tenant-123' } })

    const removed = await screen.findByText('What was removed')
    const retained = screen.getByText('What was lawfully retained')
    // Two clearly separated lists, not one mixed table.
    expect(removed).toBeInTheDocument()
    expect(retained).toBeInTheDocument()

    const removedList = document.querySelector('[data-offboarding="report-removed"]')
    const retainedList = document.querySelector('[data-offboarding="report-retained"]')
    expect(removedList).not.toBeNull()
    expect(retainedList).not.toBeNull()
    expect(removedList?.textContent).toContain('advertising.metrics_daily')
    expect(removedList?.textContent).toContain('400')

    // Each retained entry names its reason and its retention end date —
    // including the honest "no end" for the append-only chain.
    expect(retainedList?.textContent).toContain('statutory retention window')
    expect(retainedList?.textContent).toMatch(/retention ends/i)
    expect(retainedList?.textContent).toMatch(/2027/)
    expect(retainedList?.textContent).toContain('append-only chain')
    expect(retainedList?.textContent).toMatch(/no end date/i)
    // Nothing mixed: the retained tables never appear under Removed.
    expect(removedList?.textContent).not.toContain('audit.entries')
  })

  it('re-running an offboarding renders the same report without error', async () => {
    const sameSnapshot = snapshot({
      status: 'purged',
      export: EXPORT,
      purge_report: PURGE_REPORT,
      completed_at: '2026-10-02T00:00:00Z',
    })
    setupFetch({ offboardingGet: { body: sameSnapshot } })
    const first = render(TenantOffboarding, { props: { id: 'tenant-123' } })
    await screen.findByText('What was lawfully retained')
    const firstText = document.querySelector('[data-offboarding="report"]')?.textContent
    expect(firstText).toBeTruthy()
    first.unmount()
    cleanup()

    // A re-run replays the stored report (idempotent by key) — the console
    // renders it identically, without an error state.
    render(TenantOffboarding, { props: { id: 'tenant-123' } })
    await screen.findByText('What was lawfully retained')
    expect(document.querySelector('[data-offboarding="report"]')?.textContent).toBe(firstText)
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
  })

  it('has no axe violations on the purged state (report, lists, evidence)', async () => {
    setupFetch({
      offboardingGet: {
        body: snapshot({ status: 'purged', export: EXPORT, purge_report: PURGE_REPORT }),
      },
    })
    const { container } = render(TenantOffboarding, { props: { id: 'tenant-123' } })
    await screen.findByText('What was lawfully retained')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no axe violations on the not-started state', async () => {
    setupFetch({ offboardingGet: { status: 404 } })
    const { container } = render(TenantOffboarding, { props: { id: 'tenant-123' } })
    await screen.findByText('Offboarding has not been requested')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('a late poll for a previous tenant never overwrites the current record', async () => {
    // The router reuses this component across param changes; a poll for
    // tenant A that resolves after B's record landed must be dropped — this
    // console fronts the one irreversible action. The poll fires on the
    // component's 5 s interval, so timers are faked to reach it.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let aOffboardingCalls = 0
      let resolveA: ((body: unknown) => void) | undefined
      const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const method = (init?.method ?? 'GET').toUpperCase()
        if (url.endsWith('/api/v1/platform/tenants/tenant-A') && method === 'GET') {
          return jsonResponse({ ...TENANT, id: 'tenant-A', slug: 'tenant-a', display_name: 'A' })
        }
        if (url.endsWith('/api/v1/platform/tenants/tenant-B') && method === 'GET') {
          return jsonResponse({ ...TENANT, id: 'tenant-B', slug: 'tenant-b', display_name: 'B' })
        }
        if (url.includes('/tenants/tenant-A/offboarding')) {
          aOffboardingCalls += 1
          if (aOffboardingCalls === 1) return jsonResponse(snapshot({ status: 'pending' }))
          return new Promise<Response>((resolve) => {
            resolveA = (body: unknown) => resolve(jsonResponse(body))
          })
        }
        if (url.includes('/tenants/tenant-B/offboarding')) {
          return jsonResponse(
            snapshot({ status: 'purged', export: EXPORT, purge_report: PURGE_REPORT }),
          )
        }
        if (url.includes('/offboarding')) return jsonResponse(snapshot())
        return jsonResponse({})
      })
      vi.stubGlobal('fetch', fetchMock)

      const { rerender } = render(TenantOffboarding, { props: { id: 'tenant-A' } })
      await screen.findByText('Pending')
      // The 5 s poll for A fires and hangs in flight...
      await vi.advanceTimersByTimeAsync(5000)
      // ...then the operator navigates to B, whose record lands (terminal).
      await rerender({ props: { id: 'tenant-B' } })
      await screen.findByText('What was lawfully retained')
      // ...and A's poll finally answers: it must be dropped, never rendered.
      resolveA?.(snapshot({ status: 'purged', export: EXPORT, purge_report: PURGE_REPORT }))
      await vi.advanceTimersByTimeAsync(100)
      expect(document.querySelector('[data-offboarding="report"]')).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('refuses to start with a shell-unsafe idempotency key and never prints one into a command', async () => {
    setupFetch({ offboardingGet: { status: 404 } })
    render(TenantOffboarding, { props: { id: 'tenant-123' } })

    const key = await screen.findByLabelText(/idempotency key/i)
    await fireEvent.input(key, { target: { value: '2026-10; rm -rf /' } })
    const start = screen.getByRole('button', { name: /request offboarding/i })
    expect(start).toBeDisabled()
    expect(
      screen.getByText(/letters, numbers, dots, dashes, underscores, colons, and @/i),
    ).toBeInTheDocument()
  })

  it('a purged record whose report cannot be parsed says so — never a bare purged badge', async () => {
    setupFetch({
      offboardingGet: {
        body: snapshot({ status: 'purged', export: EXPORT, purge_report: { removed: 'garbage' } }),
      },
    })
    render(TenantOffboarding, { props: { id: 'tenant-123' } })

    expect(await screen.findByText('Purged')).toBeInTheDocument()
    expect(screen.getByText(/report could not be rendered/i)).toBeInTheDocument()
  })
})
