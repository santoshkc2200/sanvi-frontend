import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { cleanup, render, screen, within } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Conversions from '../src/routes/advertising/Conversions.svelte'

/**
 * The captured-conversions list (TASK-014). The load-bearing assertions are
 * the ones the slice exists for: value + value source + directive outcome on
 * every row, and an upload status column that says "available after upload
 * is enabled" instead of rendering blank.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function conversionEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: '9007199254740993',
    tenant_id: 'dev-acme',
    event_id: 'conv-1',
    name: 'purchase',
    occurred_at: '2026-09-05T10:00:00Z',
    click_ids: { gclid: 'g-1' },
    hashed_identifiers: {},
    consent: {
      answers: { ads_measurement: 'allowed' },
      jurisdiction: 'jp',
      purposes_asked: ['ads_measurement'],
      resolver_version: '2026-08-01',
      signal_source: 'ui',
    },
    upload_states: { meta: { status: 'uploaded', attempt_count: 1 } },
    value: { amount_minor: 4800, currency: 'USD' },
    value_source: 'payment_record',
    order_ref: 'ord-1',
    ...overrides,
  }
}

function setupFetch(events: unknown[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/ads/conversions')) return jsonResponse(events)
    return jsonResponse({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setLocale('en')
  setEntitlements([])
  setSession({
    userId: 'usr_1',
    email: 'owner@example.com',
    emailVerified: true,
    status: 'active',
    memberships: [],
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

describe('conversions list', () => {
  it('renders each captured event with value, value source, and directive outcome', async () => {
    setupFetch([
      conversionEvent({ name: 'purchase' }),
      conversionEvent({
        id: '9007199254740994',
        name: 'signup_lead',
        value: null,
        value_source: null,
        consent: {
          answers: { ads_measurement: 'denied' },
          jurisdiction: 'us-ca',
          purposes_asked: ['ads_measurement'],
          resolver_version: '2026-08-01',
          signal_source: 'gpc',
        },
      }),
    ])
    render(Conversions)

    const table = await screen.findByRole('table', { name: 'Captured conversion events' })
    const rows = within(table).getAllByRole('row')
    const permitted = rows.find((row) => within(row).queryByText('purchase'))
    expect(permitted).toBeTruthy()
    expect(within(permitted!).getByText('$48.00')).toBeVisible()
    expect(within(permitted!).getByText('Payment record')).toBeVisible()
    expect(within(permitted!).getByText('Captured — uploads permitted')).toBeVisible()

    const suppressed = rows.find((row) => within(row).queryByText('signup_lead'))
    expect(suppressed).toBeTruthy()
    // No value carried: an honest dash, never a fabricated zero.
    expect(within(suppressed!).getAllByText('—').length).toBeGreaterThan(0)
    expect(
      within(suppressed!).getByText(/suppressed by Ad measurement \(signal: Gpc\)/),
    ).toBeVisible()
  })

  it('renders the real per-platform upload states once upload is enabled (TASK-015)', async () => {
    setupFetch([
      conversionEvent(),
      conversionEvent({
        id: '9007199254740994',
        name: 'signup_lead',
        value: null,
        value_source: null,
        consent: {
          answers: { ads_measurement: 'denied' },
          jurisdiction: 'us-ca',
          purposes_asked: ['ads_measurement'],
          resolver_version: '2026-08-01',
          signal_source: 'gpc',
        },
        upload_states: {},
      }),
    ])
    render(Conversions)

    const table = await screen.findByRole('table', { name: 'Captured conversion events' })
    // The permitted event renders its uploaded state per platform.
    expect(within(table).getByText('Meta:')).toBeVisible()
    expect(within(table).getByText('Uploaded')).toBeVisible()
    // The suppressed event was never uploaded — a labelled note, never blank.
    expect(within(table).getByText('Not uploaded — no platform attempts recorded')).toBeVisible()
  })

  it('renders the empty state when nothing has been captured yet', async () => {
    setupFetch([])
    render(Conversions)

    expect(await screen.findByText('No conversions yet')).toBeVisible()
    expect(
      screen.getByText('When a storefront order is paid, its conversion event appears here.'),
    ).toBeVisible()
  })

  it('renders the upgrade prompt when the conversions endpoint refuses (403)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/ads/conversions')) return jsonResponse({}, 403)
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)
    render(Conversions)

    expect(await screen.findByText('Upgrade required')).toBeVisible()
  })

  it('passes axe with rows, an empty list, and the labelled upload column', async () => {
    setupFetch([conversionEvent()])
    const { container } = render(Conversions)

    await screen.findByRole('table', { name: 'Captured conversion events' })

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
