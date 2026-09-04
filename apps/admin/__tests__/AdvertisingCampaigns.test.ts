import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Campaigns from '../src/routes/advertising/Campaigns.svelte'
import { fixturePlatformByKey, platformViewFixture } from '@sanvi/ui/test-fixtures'

/**
 * The campaign list (TASK-012): the cross-platform table, the bulk
 * pause/resume confirmations that name what they affect, and the drift
 * indicator. Fetch is stubbed at the HTTP boundary, so the whole
 * api-client → screen path runs for real.
 */

const GOOGLE = fixturePlatformByKey('google_ads')!
const META = fixturePlatformByKey('meta')!

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const HEALTH = {
  can_sync: true,
  can_upload_conversions: true,
  scopes_missing: [] as string[],
  reconnect_required: false,
  token_expires_at: null,
  last_error: null,
  last_synced_at: '2026-09-03T11:00:00Z',
}

function connection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn_google_1',
    platform: GOOGLE.key,
    external_account_id: '123-456',
    account_name: 'Tokyo Retail',
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
    status: 'active',
    health: { ...HEALTH },
    ...overrides,
  }
}

function campaignView(overrides: Record<string, unknown> = {}) {
  const { campaign: campaignOverrides, ...viewOverrides } = overrides
  return {
    id: 'camp_1',
    connection_id: 'conn_google_1',
    platform: GOOGLE.key,
    external_id: null,
    revision: 3,
    campaign: {
      id: 'camp_1',
      name: 'Summer sale',
      objective: GOOGLE.capability_matrix.objectives[0],
      budget: { kind: 'daily', amount: { amount_minor: 1500, currency: 'JPY' } },
      schedule: null,
      status: 'active',
      drift: { drifted: false, changed_fields: [] as string[] },
      ad_groups: [],
      ...(campaignOverrides as Record<string, unknown> | undefined),
    },
    ...viewOverrides,
  }
}

function setupFetch(
  options: {
    connections?: unknown[]
    campaigns?: unknown[]
    mutate?: (url: string, body: unknown) => Response | undefined
  } = {},
): ReturnType<typeof vi.fn> {
  const connections = options.connections ?? [connection()]
  const campaigns = options.campaigns ?? [campaignView()]
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/ads/platforms')) {
      return jsonResponse({
        platforms: [
          platformViewFixture(GOOGLE, { connection_state: 'connected' }),
          platformViewFixture(META),
        ],
      })
    }
    if (url.endsWith('/ads/connections')) return jsonResponse({ connections })
    if (url.endsWith('/ads/campaigns')) return jsonResponse({ campaigns })
    if (url.includes('/pause') || url.includes('/resume')) {
      return options.mutate?.(url, init?.body) ?? jsonResponse(campaigns[0])
    }
    return jsonResponse({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setEntitlements([])
  setLocale('en')
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
    methods: ['totp'],
    authenticatedAt: new Date().toISOString(),
    locale: 'en',
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  setSession(null)
})

describe('AdvertisingCampaigns list (phase 10, TASK-012)', () => {
  it('renders one cross-platform table with per-account budgets and empty metric columns', async () => {
    setupFetch({
      campaigns: [
        campaignView(),
        campaignView({
          id: 'camp_2',
          connection_id: 'conn_meta_1',
          platform: META.key,
          campaign: {
            name: 'Meta push',
            status: 'paused',
            budget: { kind: 'lifetime', amount: { amount_minor: 9000, currency: 'USD' } },
          },
        }),
      ],
      connections: [
        connection(),
        connection({ id: 'conn_meta_1', platform: META.key, currency: 'USD' }),
      ],
    })
    render(Campaigns)

    expect(await screen.findByText('Summer sale')).toBeInTheDocument()
    expect(screen.getByText('Meta push')).toBeInTheDocument()
    // Budgets render natively per ad account currency — never converted.
    expect(screen.getByText(/¥1,500/)).toBeInTheDocument()
    expect(screen.getByText(/\$90\.00/)).toBeInTheDocument()
    // Platform display names come from the catalog, not raw keys.
    expect(screen.getByText(GOOGLE.display_name)).toBeInTheDocument()
    expect(screen.getByText(META.display_name)).toBeInTheDocument()
    // Performance columns stand empty until TASK-016 — an em dash, not a zero.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })

  it('shows a drift indicator linked to the drift view when the platform changed a campaign', async () => {
    setupFetch({
      campaigns: [
        campaignView({ campaign: { drift: { drifted: true, changed_fields: ['budget'] } } }),
      ],
    })
    render(Campaigns)

    const link = await screen.findByRole('link', { name: 'Changed outside Sanvi' })
    expect(link).toHaveAttribute('href', '/advertising/campaigns/camp_1/drift')
  })

  it('bulk pause confirms with the campaign count and the combined daily budget', async () => {
    setupFetch({
      campaigns: [
        campaignView(),
        campaignView({ id: 'camp_2', campaign: { name: 'Second', status: 'active' } }),
      ],
    })
    render(Campaigns)

    await screen.findByText('Summer sale')
    const checkboxes = screen.getAllByRole('checkbox')
    // Header select-all plus per-row boxes; select everything.
    for (const box of checkboxes) {
      if (!(box as HTMLInputElement).checked) fireEvent.click(box)
    }

    fireEvent.click(screen.getByRole('button', { name: 'Pause selected' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/pauses 2 campaigns/)).toBeInTheDocument()
    // One currency present → one line with the combined amount.
    expect(within(dialog).getByText('¥3,000')).toBeInTheDocument()
  })

  it('combined budgets never add across currencies — one line per currency', async () => {
    setupFetch({
      campaigns: [
        campaignView(),
        campaignView({
          id: 'camp_2',
          connection_id: 'conn_meta_1',
          platform: META.key,
          campaign: {
            name: 'Second',
            status: 'active',
            budget: { kind: 'daily', amount: { amount_minor: 9000, currency: 'USD' } },
          },
        }),
      ],
      connections: [
        connection(),
        connection({ id: 'conn_meta_1', platform: META.key, currency: 'USD' }),
      ],
    })
    render(Campaigns)

    await screen.findByText('Summer sale')
    for (const box of screen.getAllByRole('checkbox')) {
      if (!(box as HTMLInputElement).checked) fireEvent.click(box)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Pause selected' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('¥1,500')).toBeInTheDocument()
    expect(within(dialog).getByText('$90.00')).toBeInTheDocument()
    expect(within(dialog).queryByText(/¥\d.*,.*\$/)).toBeNull()
  })

  it('bulk pause sends one pause call per selected campaign', async () => {
    const fetchMock = setupFetch({
      campaigns: [
        campaignView(),
        campaignView({ id: 'camp_2', campaign: { name: 'Second', status: 'active' } }),
      ],
    })
    render(Campaigns)

    await screen.findByText('Summer sale')
    for (const box of screen.getAllByRole('checkbox')) {
      if (!(box as HTMLInputElement).checked) fireEvent.click(box)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Pause selected' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pause campaigns' }))

    await waitFor(() => {
      const pauseCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('/pause'))
      expect(pauseCalls.length).toBe(2)
    })
    // Every mutation carries an Idempotency-Key.
    for (const [, init] of fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/pause'),
    )) {
      expect((init as RequestInit | undefined)?.headers).toHaveProperty('idempotency-key')
    }
  })

  it('single resume names the budget and confirms before spending resumes', async () => {
    const fetchMock = setupFetch({
      campaigns: [campaignView({ campaign: { status: 'paused' } })],
    })
    render(Campaigns)

    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/¥1,500/)).toBeInTheDocument()

    const before = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/resume'),
    ).length
    expect(before).toBe(0)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Resume now' }))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).includes('/resume')).length,
      ).toBe(1)
    })
  })

  it('without any connection the page points at the connections screen, not an empty table', async () => {
    setupFetch({ connections: [], campaigns: [] })
    render(Campaigns)

    expect(await screen.findByText('No ad account connected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Manage connections' })).toBeInTheDocument()
  })

  it('sorts the cross-platform list by the platform column without mixing currencies', async () => {
    setupFetch({
      campaigns: [
        campaignView({ id: 'camp_1' }),
        campaignView({
          id: 'camp_2',
          connection_id: 'conn_meta_1',
          platform: META.key,
          campaign: {
            name: 'Meta push',
            status: 'paused',
            budget: { kind: 'lifetime', amount: { amount_minor: 9000, currency: 'USD' } },
          },
        }),
      ],
      connections: [
        connection(),
        connection({ id: 'conn_meta_1', platform: META.key, currency: 'USD' }),
      ],
    })
    render(Campaigns)

    await screen.findByText('Summer sale')
    // TASK-013: the platform column is a sortable badge column now. Sorting
    // reorders rows; the per-currency budget cells render untouched.
    fireEvent.click(screen.getByRole('button', { name: /Platform/ }))
    await waitFor(() => {
      const badges = screen.getAllByText(/^(Google Ads|Meta Ads)$/)
      expect(badges[0]).toHaveTextContent('Google Ads')
    })
    fireEvent.click(screen.getByRole('button', { name: /Platform/ }))
    await waitFor(() => {
      const badges = screen.getAllByText(/^(Google Ads|Meta Ads)$/)
      expect(badges[0]).toHaveTextContent('Meta Ads')
    })
    // Both currencies still render natively — sorting never sums.
    expect(screen.getByText(/¥1,500/)).toBeInTheDocument()
    expect(screen.getByText(/\$90\.00/)).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    setupFetch()
    const { container } = render(Campaigns)
    await screen.findByText('Summer sale')
    expect(await axe(container)).toHaveNoViolations()
  })
})
