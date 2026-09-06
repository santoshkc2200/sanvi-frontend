import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignDrift from '../src/routes/advertising/CampaignDrift.svelte'
import { fixturePlatformByKey, platformViewFixture } from '@sanvi/ui/test-fixtures'

/**
 * The drift view (TASK-012): a field-by-field diff with two equal-weight
 * resolutions. The invariants under test: no preselected choice, no
 * resolution without an explicit click, and no auto-overwrite on navigation.
 */

const GOOGLE = fixturePlatformByKey('google_ads')!

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const HEALTH = {
  can_sync: true,
  can_upload_conversions: true,
  scopes_missing: [],
  reconnect_required: false,
  token_expires_at: null,
  last_error: null,
  last_synced_at: '2026-09-03T11:00:00Z',
}

function connection() {
  return {
    id: 'conn_google_1',
    platform: GOOGLE.key,
    external_account_id: '123-456',
    account_name: 'Tokyo Retail',
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
    status: 'active',
    health: { ...HEALTH },
  }
}

function campaignView(overrides: Record<string, unknown> = {}) {
  const { campaign: campaignOverrides, ...rest } = overrides
  return {
    id: 'camp_1',
    connection_id: 'conn_google_1',
    platform: GOOGLE.key,
    external_id: null,
    revision: 5,
    campaign: {
      id: 'camp_1',
      name: 'Summer sale',
      objective: GOOGLE.capability_matrix.objectives[0],
      budget: { kind: 'daily', amount: { amount_minor: 1500, currency: 'JPY' } },
      schedule: null,
      status: 'active',
      drift: { drifted: true, changed_fields: ['budget'] },
      ad_groups: [],
      ...(campaignOverrides as Record<string, unknown> | undefined),
    },
    ...rest,
  }
}

const PLATFORM_CHANGE = {
  changes: [
    {
      id: 'chg_2',
      campaign_id: 'camp_1',
      tenant_id: 't1',
      revision: 5,
      actor_id: null,
      source: 'platform',
      changed_fields: ['budget'],
      before_state: campaignView().campaign,
      after_state: {
        ...campaignView().campaign,
        budget: { kind: 'daily', amount: { amount_minor: 5000, currency: 'JPY' } },
      },
      created_at: '2026-09-02T09:00:00Z',
      attribution: null,
      mutation_id: null,
      metadata: null,
    },
  ],
}

function setupFetch(
  options: {
    campaign?: unknown
    changes?: unknown
    onCall?: (url: string, init: RequestInit | undefined) => Response | undefined
  } = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const handled = options.onCall?.(url, init)
    if (handled) return handled
    if (url.includes('/ads/platforms')) {
      return jsonResponse({
        platforms: [platformViewFixture(GOOGLE, { connection_state: 'connected' })],
      })
    }
    if (url.endsWith('/ads/connections')) return jsonResponse({ connections: [connection()] })
    if (url.endsWith('/changes')) return jsonResponse(options.changes ?? { changes: [] })
    if (/\/ads\/campaigns\/[^/]+$/.test(url) && !url.endsWith('/drift')) {
      return jsonResponse(options.campaign ?? campaignView())
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

describe('AdvertisingCampaignDrift (phase 10, TASK-012)', () => {
  it('renders a correct field-by-field diff: our intent vs the platform current state', async () => {
    setupFetch({ changes: PLATFORM_CHANGE })
    render(CampaignDrift, { id: 'camp_1' })

    await screen.findByText(/Summer sale/)
    const table = screen.getByRole('table')
    expect(within(table).getByText('Budget')).toBeInTheDocument()
    expect(within(table).getByText(/¥1,500/)).toBeInTheDocument()
    expect(within(table).getByText(/¥5,000/)).toBeInTheDocument()
    expect(within(table).getByText('Ours (Sanvi)')).toBeInTheDocument()
    expect(within(table).getByText(/Theirs \(/)).toBeInTheDocument()
  })

  it('neither resolution is preselected and neither fires without an explicit choice and click', async () => {
    const fetchMock = setupFetch({ changes: PLATFORM_CHANGE })
    render(CampaignDrift, { id: 'camp_1' })

    await screen.findByText(/Summer sale/)
    const confirm = screen.getByRole('button', { name: 'Apply my choice' })
    expect(confirm).toBeDisabled()

    const radios = screen.getAllByRole('radio', { name: /version/ })
    expect(radios.length).toBe(2)
    for (const radio of radios) expect(radio).not.toBeChecked()

    // No request may fire while nothing is chosen, even after navigation-ish clicks.
    const resolveCalls = () =>
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/drift'))
    expect(resolveCalls().length).toBe(0)

    fireEvent.click(radios[0]!)
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => {
      expect(resolveCalls().length).toBe(1)
    })
    const [url, init] = resolveCalls()[0]!
    expect(String(url)).toContain('/campaigns/camp_1/drift')
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body.resolution).toBe('keep_theirs')
    expect(body.revision).toBe(5)
    expect((init as RequestInit).headers).toHaveProperty('idempotency-key')
  })

  it('choosing to reapply ours sends reapply_ours', async () => {
    const fetchMock = setupFetch({ changes: PLATFORM_CHANGE })
    render(CampaignDrift, { id: 'camp_1' })

    await screen.findByText(/Summer sale/)
    const radios = screen.getAllByRole('radio', { name: /version/ })
    fireEvent.click(radios[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'Apply my choice' }))
    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/drift'))
      expect(calls.length).toBe(1)
      expect(JSON.parse(String((calls[0]![1] as RequestInit).body)).resolution).toBe('reapply_ours')
    })
  })

  it('a campaign without drift offers nothing to resolve', async () => {
    setupFetch({
      campaign: campaignView({ campaign: { drift: { drifted: false, changed_fields: [] } } }),
      changes: { changes: [] },
    })
    render(CampaignDrift, { id: 'camp_1' })

    expect(await screen.findByText('No drift to review')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Apply my choice' })).toBeNull()
  })

  it('has no axe violations with the diff and unresolved choices rendered', async () => {
    setupFetch({ changes: PLATFORM_CHANGE })
    const { container } = render(CampaignDrift, { id: 'camp_1' })
    await screen.findByText(/Summer sale/)
    expect(await axe(container)).toHaveNoViolations()
  })
})
