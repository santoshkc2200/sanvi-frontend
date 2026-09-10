import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { cleanup, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from '../src/routes/advertising/Dashboard.svelte'
import { fixturePlatformByKey, platformViewFixture } from '@sanvi/ui/test-fixtures'

/**
 * The ROAS dashboard (TASK-016). Fetch is stubbed at the HTTP boundary so
 * the whole api-client → screen path runs for real. The assertions map to
 * the acceptance criteria: two labelled numbers everywhere, no blended
 * total across currencies, restatement flagged, freshness from the
 * backend's `stalled` flag, and the API's message on an over-long range.
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

function summaryRow(overrides: Record<string, unknown> = {}) {
  return {
    clicks: 100,
    conversion_value: { amount_minor: 120000, currency: 'JPY' },
    conversions: 12,
    currency: 'JPY',
    impressions: 10000,
    restating: false,
    roas_platform: 2,
    roas_sanvi: 1.5,
    sanvi_revenue: { amount_minor: 90000, currency: 'JPY' },
    spend: { amount_minor: 60000, currency: 'JPY' },
    ...overrides,
  }
}

function metricPoint(overrides: Record<string, unknown> = {}) {
  return {
    campaign_id: 'camp_1',
    clicks: 40,
    conversion_value: { amount_minor: 20000, currency: 'JPY' },
    conversions: 2,
    date: '2026-09-01',
    impressions: 3000,
    platform: GOOGLE.key,
    rendered_spend: null,
    restating: false,
    roas_platform: 2,
    roas_sanvi: 1.5,
    sanvi_revenue: { amount_minor: 15000, currency: 'JPY' },
    spend: { amount_minor: 10000, currency: 'JPY' },
    ...overrides,
  }
}

const CAMPAIGN = {
  id: 'camp_1',
  connection_id: 'conn_google_1',
  platform: GOOGLE.key,
  external_id: 'ext-1',
  revision: 1,
  campaign: {
    id: 'camp_1',
    name: 'Summer sale',
    objective: 'sales',
    budget: { kind: 'daily', amount: { amount_minor: 1500, currency: 'JPY' } },
    schedule: null,
    status: 'active',
    drift: { drifted: false, changed_fields: [] },
    ad_groups: [],
  },
}

function setupFetch(handlers: {
  connections?: unknown[]
  campaigns?: unknown[]
  freshness?: unknown
  summary?: unknown
  metricsRows?: unknown[]
  metricsProblem?: { status: number; detail?: string }
}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/ads/metrics/summary')) {
      if (handlers.metricsProblem) {
        return new Response(
          JSON.stringify({
            type: 'about:blank',
            title: 'Range too long',
            status: handlers.metricsProblem.status,
            ...(handlers.metricsProblem.detail ? { detail: handlers.metricsProblem.detail } : {}),
          }),
          {
            status: handlers.metricsProblem.status,
            headers: { 'content-type': 'application/problem+json' },
          },
        )
      }
      return jsonResponse({ current: handlers.summary ?? [], compared: [] })
    }
    if (url.includes('/ads/metrics/freshness')) return jsonResponse(handlers.freshness ?? {})
    if (url.includes('/ads/metrics')) return jsonResponse({ rows: handlers.metricsRows ?? [] })
    if (url.includes('/ads/platforms')) {
      return jsonResponse({
        platforms: [
          platformViewFixture(GOOGLE, { connection_state: 'connected' }),
          platformViewFixture(META),
        ],
      })
    }
    if (url.endsWith('/ads/connections')) {
      return jsonResponse({ connections: handlers.connections ?? [connection()] })
    }
    if (url.endsWith('/ads/campaigns'))
      return jsonResponse({ campaigns: handlers.campaigns ?? [CAMPAIGN] })
    return jsonResponse({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setEntitlements([{ feature: 'advertising.dashboard', enabled: true }])
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
        permissions: ['advertising.read', 'advertising.campaign.write', 'advertising.metrics.read'],
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

describe('AdvertisingDashboard (phase 10, TASK-016)', () => {
  it('renders KPI tiles with both revenue numbers labelled side by side', async () => {
    setupFetch({ summary: [summaryRow()], metricsRows: [metricPoint()] })
    render(Dashboard)

    expect((await screen.findAllByText('Conversion value (platform)')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Revenue (Sanvi)').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ROAS (platform)').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ROAS (Sanvi)').length).toBeGreaterThan(0)
    // One click from every ROAS figure reaches the explainer.
    expect(
      screen.getAllByRole('button', { name: 'About these numbers' }).length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('renders JPY with no decimals and marks restating days as still updating', async () => {
    setupFetch({
      summary: [summaryRow({ restating: true })],
      metricsRows: [
        metricPoint({ date: '2026-09-01', restating: true }),
        metricPoint({ date: '2026-09-02' }),
      ],
    })
    render(Dashboard)

    expect(await screen.findByText('¥60,000')).toBeInTheDocument()
    // The restatement marker appears in chart flags; the note explains it.
    await screen.findAllByText('Still updating')
    expect(screen.getAllByText(/restatement window/i).length).toBeGreaterThan(0)
  })

  it('two connections in different currencies render natively with no summed total', async () => {
    setupFetch({
      connections: [
        connection(),
        connection({
          id: 'conn_meta_1',
          platform: META.key,
          currency: 'USD',
          timezone: 'America/New_York',
        }),
      ],
      summary: [
        summaryRow(),
        summaryRow({
          currency: 'USD',
          conversion_value: { amount_minor: 50000, currency: 'USD' },
          sanvi_revenue: { amount_minor: 40000, currency: 'USD' },
          spend: { amount_minor: 20000, currency: 'USD' },
        }),
      ],
      metricsRows: [
        metricPoint(),
        metricPoint({
          campaign_id: 'camp_2',
          platform: META.key,
          currency: 'USD',
          conversion_value: { amount_minor: 9000, currency: 'USD' },
          sanvi_revenue: { amount_minor: 7000, currency: 'USD' },
          spend: { amount_minor: 5000, currency: 'USD' },
        }),
      ],
    })
    render(Dashboard)

    // Both currencies render natively…
    expect(await screen.findByText('¥60,000')).toBeInTheDocument()
    expect(screen.getByText('$200.00')).toBeInTheDocument()
    // …and differing timezones are stated, not reconciled.
    expect(screen.getByText(/different timezones/)).toBeInTheDocument()
    // Per-currency breakdown tables (one per currency), no combined row.
    expect(screen.getAllByRole('columnheader', { name: 'Spend' }).length).toBeGreaterThanOrEqual(2)
    // Breakdown money cells format per currency — JPY never grows decimals.
    // (The chart's data table carries the same figures — duplicates are fine.)
    expect(screen.getAllByText('¥10,000').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$50.00').length).toBeGreaterThan(0)
  })

  it('renders the sync-failed state from the backend freshness flag, never from a clock guess', async () => {
    setupFetch({
      summary: [summaryRow()],
      freshness: {
        connections: [
          {
            connection_id: 'conn_google_1',
            platform: GOOGLE.key,
            last_ingested_at: '2026-09-01T00:00:00Z',
            lag_hours: 60,
            stalled: true,
          },
        ],
      },
    })
    render(Dashboard)

    expect(await screen.findByText('A connection stopped syncing')).toBeInTheDocument()
    expect(screen.getAllByText(/sync failed/).length).toBeGreaterThan(0)
  })

  it('shows the API’s own message for an over-long range instead of a spinner', async () => {
    setupFetch({
      summary: [],
      metricsProblem: { status: 400, detail: 'Date range cannot exceed 92 days' },
    })
    render(Dashboard)

    expect(await screen.findByText('Date range cannot exceed 92 days')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('with the advertising.dashboard flag off the page renders its paused state', async () => {
    setEntitlements([])
    const fetchMock = setupFetch({ summary: [summaryRow()] })
    render(Dashboard)

    expect(await screen.findByText('Performance dashboard is not enabled yet')).toBeInTheDocument()
    const metricCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('/metrics'))
    expect(metricCalls).toHaveLength(0)
  })

  it('without any connection the page points at the connections screen', async () => {
    setupFetch({ connections: [], campaigns: [] })
    render(Dashboard)

    expect(await screen.findByText('No ad account connected')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    setupFetch({
      summary: [summaryRow({ restating: true })],
      metricsRows: [metricPoint({ restating: true })],
    })
    const { container } = render(Dashboard)
    await screen.findAllByText('Conversion value (platform)')
    expect(await axe(container)).toHaveNoViolations()
  })
})
