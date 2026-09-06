import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignDetail from '../src/routes/advertising/CampaignDetail.svelte'
import { fixturePlatformByKey, platformViewFixture } from '@sanvi/ui/test-fixtures'

/**
 * The campaign detail (TASK-012): the campaign tree, the change log as
 * readable history with platform attribution, and the money mutations —
 * publish confirms before spending starts.
 */

const GOOGLE = fixturePlatformByKey('google_ads')!

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function problemResponse(status: number, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title: 'Error', status, ...extra }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
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
    external_id: 'plat-777',
    revision: 5,
    campaign: {
      id: 'camp_1',
      name: 'Summer sale',
      objective: GOOGLE.capability_matrix.objectives[0],
      budget: { kind: 'daily', amount: { amount_minor: 1500, currency: 'JPY' } },
      schedule: null,
      status: 'paused',
      drift: { drifted: true, changed_fields: ['budget'] },
      ad_groups: [
        {
          id: 'grp_1',
          name: 'Shoppers',
          bid: { strategy: 'manual', maximum_bid: null },
          targeting: { dimensions: { geo: [] }, extension_fields: {} },
          ads: [
            {
              id: 'ad_1',
              creative: {
                id: 'cre_1',
                placement: 'feed',
                texts: [{ locale: 'en', headline: 'Big savings', body: 'Shop now' }],
                asset_references: [],
              },
              landing_url: 'https://tenant.example/sale',
              tracking_template: null,
            },
          ],
        },
      ],
      ...(campaignOverrides as Record<string, unknown> | undefined),
    },
    ...rest,
  }
}

const CHANGES = {
  changes: [
    {
      id: 'chg_2',
      campaign_id: 'camp_1',
      tenant_id: 't1',
      revision: 5,
      actor_id: 'usr_9',
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
    {
      id: 'chg_1',
      campaign_id: 'camp_1',
      tenant_id: 't1',
      revision: 4,
      actor_id: 'usr_1',
      source: 'sanvi',
      changed_fields: ['status'],
      before_state: { ...campaignView().campaign, status: 'active' },
      after_state: campaignView().campaign,
      created_at: '2026-09-01T15:00:00Z',
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
    members?: unknown
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
    if (
      /\/ads\/campaigns\/[^/]+$/.test(url) &&
      (init as RequestInit | undefined)?.method !== 'PATCH'
    ) {
      return jsonResponse(options.campaign ?? campaignView())
    }
    if (url.endsWith('/members')) return jsonResponse(options.members ?? [])
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
        permissions: ['advertising.read', 'advertising.campaign.write', 'identity.member.read'],
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

describe('AdvertisingCampaignDetail (phase 10, TASK-012)', () => {
  it('renders the campaign header, drift banner, and the ad-group tree', async () => {
    setupFetch()
    render(CampaignDetail, { id: 'camp_1' })

    expect(await screen.findByRole('heading', { name: 'Summer sale' })).toBeInTheDocument()
    // Drift is surfaced, never silently resolved.
    expect((await screen.findAllByText(/changed outside Sanvi/i)).length).toBeGreaterThanOrEqual(2)
    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))
    void screen
    // The tree: ad group with its ad.
    expect(screen.getByText('Shoppers')).toBeInTheDocument()
    expect(screen.getByText('Big savings')).toBeInTheDocument()
    expect(screen.getByText('https://tenant.example/sale')).toBeInTheDocument()
    // Budget meta in the ad account's currency; the platform id when published.
    expect(screen.getAllByText(/¥1,500/).length).toBeGreaterThan(0)
    expect(screen.getByText(/plat-777/)).toBeInTheDocument()
  })

  it('the change log answers "who paused this" with platform-sourced changes attributed to the platform', async () => {
    setupFetch({
      changes: CHANGES,
      members: [
        {
          user_id: 'usr_1',
          email: 'owner@example.com',
          status: 'active',
          role_ids: ['owner'],
        },
      ],
    })
    render(CampaignDetail, { id: 'camp_1' })

    expect(
      await screen.findByText(/changed this campaign in Sanvi/, {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/changed this campaign in its own tool/)).toBeInTheDocument()
    expect(screen.getByText(/owner@example.com/)).toBeInTheDocument()
    // Before → after values are spelled out, not a JSON dump.
    expect(screen.getAllByText(/¥1,500/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/¥5,000/).length).toBeGreaterThan(0)
  })

  it('publish requires an explicit confirmation that names the spending consequence', async () => {
    const fetchMock = setupFetch({ campaign: campaignView({ campaign: { status: 'draft' } }) })
    render(CampaignDetail, { id: 'camp_1' })

    await screen.findByRole('heading', { name: 'Summer sale' })
    const publishCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/publish'),
    )
    expect(publishCalls.length).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/real spending/i)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish now' }))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).includes('/publish')).length,
      ).toBe(1)
    })
    // Publish carries an Idempotency-Key.
    const publish = fetchMock.mock.calls.find(([input]) => String(input).includes('/publish'))
    expect((publish![1] as RequestInit).headers).toHaveProperty('idempotency-key')
  })

  it('a platform-side rejection on publish renders the platform message verbatim', async () => {
    setupFetch({
      campaign: campaignView({ campaign: { status: 'draft' } }),
      onCall: (url) => {
        if (url.includes('/publish')) {
          return problemResponse(400, {
            violations: [
              {
                code: 'invalid',
                field_path: 'x',
                message: 'Headline exceeds the 30-character en limit',
              },
            ],
          })
        }
        return undefined
      },
    })
    render(CampaignDetail, { id: 'camp_1' })

    await screen.findByRole('heading', { name: 'Summer sale' })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish now' }))
    expect(
      await screen.findByText('Headline exceeds the 30-character en limit'),
    ).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    setupFetch()
    const { container } = render(CampaignDetail, { id: 'camp_1' })
    await screen.findByRole('heading', { name: 'Summer sale' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
