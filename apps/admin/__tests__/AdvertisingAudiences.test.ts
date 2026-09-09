import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Audiences from '../src/routes/advertising/Audiences.svelte'

/**
 * The audience-management screen (TASK-015). The load-bearing assertions:
 * the opt-out removal rule renders before any build or refresh control,
 * building POSTs the platform draft, refresh re-evaluates the audience
 * (and its success path is what removes opted-out subjects), members
 * render as hashes only, and the whole screen passes axe.
 */

const TRACKING_ENTITLEMENT = [{ feature: 'advertising.conversion_tracking', enabled: true }]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function audience(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aud_1',
    tenant_id: 'dev-acme',
    name: 'Purchasers',
    platform: 'meta',
    status: { status: 'building' },
    included_identifiers: ['a1b2c3', 'd4e5f6'],
    external_ref: null,
    last_synced_at: null,
    created_at: '2026-09-06T08:00:00Z',
    ...overrides,
  }
}

function setupFetch(
  options: {
    audiences?: Record<string, unknown>[]
    created?: Record<string, unknown>
    refreshed?: Record<string, unknown>
  } = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (/\/ads\/audiences\/[^/]+\/refresh$/.test(url) && method === 'POST') {
      return jsonResponse(options.refreshed ?? {})
    }
    if (/\/ads\/audiences$/.test(url) && method === 'POST') {
      return jsonResponse(options.created ?? {}, 201)
    }
    if (/\/ads\/audiences/.test(url) && method === 'GET') {
      return jsonResponse(options.audiences ?? [])
    }
    if (url.includes('/ads/connections')) {
      return jsonResponse({
        connections: [
          {
            id: 'conn_1',
            platform: 'meta',
            external_account_id: '111-222',
            account_name: 'Acme Main Ad Account',
            currency: 'JPY',
            timezone: 'Asia/Tokyo',
            status: 'active',
            health: {},
          },
        ],
      })
    }
    if (url.includes('/ads/platforms')) {
      return jsonResponse({
        platforms: [
          {
            key: 'meta',
            display_name: 'Meta Ads',
            available: true,
            upgrade_required: false,
            connection_state: 'connected',
          },
        ],
      })
    }
    return jsonResponse({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setLocale('en')
  setEntitlements(TRACKING_ENTITLEMENT)
  setSession({
    userId: 'usr_1',
    email: 'owner@example.com',
    emailVerified: true,
    status: 'active',
    memberships: [
      {
        tenant_id: 'dev-acme',
        tenant_slug: 'acme',
        tenant_name: 'Acme',
        role_id: 'owner',
        permissions: ['advertising.read', 'advertising.campaign.write'],
      },
    ],
    aal: 'aal2',
    methods: ['password'],
    authenticatedAt: new Date().toISOString(),
    locale: 'en',
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('audiences — the opt-out rule', () => {
  it('states the opt-out removal rule before any build or refresh action', async () => {
    setupFetch({ audiences: [audience()] })
    render(Audiences)

    const notice = await screen.findByText(/Opt-outs are removed on refresh/)
    const buildHeading = screen.getByText('Build an audience')
    const refreshButton = screen.getByRole('button', { name: /Refresh\s*:\s*Purchasers/ })

    // The rule is stated before both actions in reading order.
    expect(
      notice.compareDocumentPosition(buildHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      notice.compareDocumentPosition(refreshButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // And says the removal is one-way.
    expect(screen.getByText(/never re-adds an opted-out subject/)).toBeTruthy()
  })
})

describe('audiences — build and refresh', () => {
  it('builds a draft audience for one connected platform', async () => {
    const created = audience({ id: 'aud_2', name: 'Recent buyers' })
    const fetchMock = setupFetch({ audiences: [audience()], created })

    render(Audiences)
    const table = await screen.findByRole('table', { name: 'Audiences' })

    fireEvent.input(screen.getByLabelText(/Audience name/), {
      target: { value: 'Recent buyers' },
    })
    fireEvent.change(screen.getByLabelText(/Platform/), {
      target: { value: 'meta' },
    })
    screen.getByRole('button', { name: 'Build audience' }).click()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/ads\/audiences$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Recent buyers', platform: 'meta' }),
        }),
      )
    })
    // The created draft appears in the list as building.
    await screen.findByText('Recent buyers')
    expect(within(table).getAllByText('Building').length).toBe(2)
  })

  it('refreshes an audience and re-renders the returned state', async () => {
    setupFetch({
      audiences: [audience()],
      refreshed: audience({
        status: { status: 'active' },
        last_synced_at: '2026-09-06T09:00:00Z',
        included_identifiers: ['a1b2c3'],
      }),
    })
    render(Audiences)

    const table = await screen.findByRole('table', { name: 'Audiences' })
    screen.getByRole('button', { name: /Refresh\s*:\s*Purchasers/ }).click()

    await waitFor(() => {
      expect(within(table).getByText('Active')).toBeTruthy()
    })
  })

  it('renders a failed audience with its reason', async () => {
    setupFetch({
      audiences: [audience({ status: { status: 'failed', reason: 'platform rejected the list' } })],
    })
    render(Audiences)

    const table = await screen.findByRole('table', { name: 'Audiences' })
    expect(within(table).getByText('Failed')).toBeTruthy()
    expect(within(table).getByText(/Reason: platform rejected the list/)).toBeTruthy()
  })
})

describe('audiences — privacy and edge cases', () => {
  it('renders members as hashes only, with the hashes-only note', async () => {
    setupFetch({ audiences: [audience()] })
    render(Audiences)

    const table = await screen.findByRole('table', { name: 'Audiences' })
    expect(within(table).getByText('2')).toBeTruthy()
    const details = within(table).getByText('View hashed identifiers (2)')
      .parentElement as HTMLDetailsElement
    details.open = true
    expect(within(details).getByText('a1b2c3')).toBeTruthy()
    expect(within(details).getByText('d4e5f6')).toBeTruthy()
    expect(within(table).getByText(/Members are stored as hashes only/)).toBeTruthy()
  })

  it('offers no build form without an active connection', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/ads/audiences')) return jsonResponse([])
      if (url.includes('/ads/connections')) {
        return jsonResponse({ connections: [] })
      }
      if (url.includes('/ads/platforms')) return jsonResponse({ platforms: [] })
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)
    render(Audiences)

    expect(await screen.findByText(/Connect an ad platform first/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Build audience' })).toBeNull()
  })

  it('renders the upgrade prompt when the audiences endpoint refuses (403)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/ads/audiences')) return jsonResponse({}, 403)
      return jsonResponse({ connections: [], platforms: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    render(Audiences)

    expect(await screen.findByText('Upgrade required')).toBeTruthy()
  })

  it('shows the paused state when tracking is disabled, and hides the refresh actions', async () => {
    setEntitlements([])
    setupFetch({ audiences: [audience()] })
    render(Audiences)

    expect(await screen.findByText('Conversion tracking is paused')).toBeTruthy()
    expect(screen.getByText(/audience builds and refreshes hold/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Refresh/ })).toBeNull()
  })

  it('passes axe with an audience in every status', async () => {
    setupFetch({
      audiences: [
        audience(),
        audience({
          id: 'aud_2',
          status: { status: 'active' },
          last_synced_at: '2026-09-06T09:00:00Z',
        }),
        audience({ id: 'aud_3', status: { status: 'failed', reason: 'rejected' } }),
      ],
    })
    const { container } = render(Audiences)

    await screen.findByRole('table', { name: 'Audiences' })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
