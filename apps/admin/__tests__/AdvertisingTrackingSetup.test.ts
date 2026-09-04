import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TrackingSetup from '../src/routes/advertising/TrackingSetup.svelte'
import { AD_PLATFORM_FIXTURES, platformViewFixture } from '@sanvi/ui/test-fixtures'

/**
 * The conversion-tracking setup screen (TASK-014) — the capture explainer,
 * the event→conversion-action mapping matrix, the consent linkage, and the
 * one-click test event. Fetch is stubbed at the HTTP boundary so the whole
 * api-client → screen path runs for real.
 */

const GOOGLE = AD_PLATFORM_FIXTURES.find((platform) => platform.key === 'google_ads')!
const META = AD_PLATFORM_FIXTURES.find((platform) => platform.key === 'meta')!

const TRACKING_ENTITLEMENT = [{ feature: 'advertising.conversion_tracking', enabled: true }]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function catalog() {
  return {
    platforms: [
      platformViewFixture(GOOGLE, { connection_state: 'connected' }),
      platformViewFixture(META, { connection_state: 'connected' }),
    ],
  }
}

const SETTINGS = {
  tenant_id: 'dev-acme',
  mappings: {
    purchase: { google_ads: 'gaction-1', meta: 'Lead123' },
  },
}

const CONSENT_ALLOWED = {
  answers: { ads_measurement: 'allowed', sale_or_share: 'allowed' },
  jurisdiction: 'us-ca',
  purposes_asked: ['ads_measurement', 'sale_or_share'],
  resolver_version: '2026-08-01',
  signal_source: 'ui',
}

const CONSENT_SUPPRESSED = {
  answers: { ads_measurement: 'allowed', sale_or_share: 'denied' },
  jurisdiction: 'us-ca',
  purposes_asked: ['ads_measurement', 'sale_or_share'],
  resolver_version: '2026-08-01',
  signal_source: 'gpc',
}

function testEventResponse(consent = CONSENT_ALLOWED) {
  return {
    captured: {
      id: '9007199254740993',
      tenant_id: 'dev-acme',
      event_id: 'test-event-1',
      name: 'purchase',
      occurred_at: '2026-09-05T10:00:00Z',
      click_ids: { gclid: 'g-abc', fbp: 'fb.1' },
      hashed_identifiers: {},
      consent,
      value: { amount_minor: 4800, currency: 'USD' },
      value_source: 'client_reported',
      order_ref: 'ord-test-1',
    },
    test: true,
  }
}

function setupFetch(
  options: { settings?: unknown; testEvent?: unknown; platformsStatus?: number } = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url.includes('/ads/platforms')) {
      if (options.platformsStatus) return jsonResponse({}, options.platformsStatus)
      return jsonResponse(catalog())
    }
    if (url.includes('/ads/tracking/settings')) {
      if (method === 'GET') return jsonResponse(options.settings ?? SETTINGS)
      if (method === 'PUT') return jsonResponse({})
    }
    if (url.includes('/ads/tracking/test-event')) {
      return jsonResponse(options.testEvent ?? testEventResponse())
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

describe('tracking setup screen', () => {
  it('renders the event→conversion-action mapping as a per-platform matrix', async () => {
    setupFetch()
    setEntitlements(TRACKING_ENTITLEMENT)
    render(TrackingSetup)

    // Columns are the platforms; rows are the events — a matrix, not a list.
    expect(await screen.findByRole('columnheader', { name: GOOGLE.display_name })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: META.display_name })).toBeVisible()
    expect(screen.getByRole('rowheader', { name: 'purchase' })).toBeVisible()
    const googleAction = screen.getByLabelText(
      `Conversion action for ${GOOGLE.display_name}`,
    ) as HTMLInputElement
    expect(googleAction.value).toBe('gaction-1')
    const metaAction = screen.getByLabelText(
      `Conversion action for ${META.display_name}`,
    ) as HTMLInputElement
    expect(metaAction.value).toBe('Lead123')
  })

  it('names the privacy dependency with the purposes and links to the privacy centre', async () => {
    setupFetch()
    setEntitlements(TRACKING_ENTITLEMENT)
    render(TrackingSetup)

    expect(await screen.findByText('Privacy dependency')).toBeVisible()
    const body = screen.getByText(/captured, but uploaded to ad platforms only while/i)
    // The purposes are named by their localized labels, not flattened.
    expect(body.textContent).toContain('Ad measurement')
    expect(body.textContent).toContain('Sale or sharing for cross-context advertising')
    expect(body.textContent).toContain('Global Privacy Control')
    expect(screen.getByRole('link', { name: 'Open the privacy centre' })).toHaveAttribute(
      'href',
      '/privacy',
    )
  })

  it('round-trips an edited matrix through PUT /tracking/settings', async () => {
    const fetchMock = setupFetch()
    setEntitlements(TRACKING_ENTITLEMENT)
    render(TrackingSetup)

    const metaAction = (await screen.findByLabelText(
      `Conversion action for ${META.display_name}`,
    )) as HTMLInputElement
    fireEvent.input(metaAction, { target: { value: 'Lead999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save mappings' }))

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
      )
      expect(put).toBeTruthy()
      const body = JSON.parse(String((put as unknown as [string, RequestInit])[1].body))
      expect(body.mappings.purchase).toEqual({ google_ads: 'gaction-1', meta: 'Lead999' })
    })
  })

  it('drops an event row locally and omits cleared actions from the PUT', async () => {
    const fetchMock = setupFetch({
      settings: {
        tenant_id: 'dev-acme',
        mappings: {
          purchase: { google_ads: 'gaction-1' },
          lead: { meta: 'LeadOnly' },
        },
      },
    })
    setEntitlements(TRACKING_ENTITLEMENT)
    render(TrackingSetup)

    expect(await screen.findByRole('rowheader', { name: 'lead' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Remove\s*:?\s*lead/ }))

    // Clearing an action cell removes it from the saved mapping entirely.
    const googleAction = screen.getByLabelText(
      `Conversion action for ${GOOGLE.display_name}`,
    ) as HTMLInputElement
    fireEvent.input(googleAction, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save mappings' }))

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
      )
      const body = JSON.parse(String((put as unknown as [string, RequestInit])[1].body))
      // `lead` is gone entirely; `purchase` stays as an explicit empty map —
      // "tracked, but mapped to no platform" — never dropped by accident.
      expect(body.mappings).toEqual({ purchase: {} })
    })
  })

  it('adds a new event row through the add-event input', async () => {
    setupFetch()
    setEntitlements(TRACKING_ENTITLEMENT)
    render(TrackingSetup)

    fireEvent.input(await screen.findByPlaceholderText('Event name'), {
      target: { value: 'begin_checkout' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }))

    expect(await screen.findByRole('rowheader', { name: 'begin_checkout' })).toBeVisible()
  })

  it('shows the explicit disabled state while conversion tracking is flagged off', async () => {
    const fetchMock = setupFetch()
    setEntitlements([])
    render(TrackingSetup)

    expect(await screen.findByText('Conversion tracking is off')).toBeVisible()
    expect(screen.getByText(/not queued for later/)).toBeVisible()
    // No matrix to edit: a form that would silently do nothing must not render.
    expect(screen.queryByRole('button', { name: 'Save mappings' })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders the upgrade prompt when the platform catalog refuses (403)', async () => {
    setupFetch({ platformsStatus: 403 })
    setEntitlements(TRACKING_ENTITLEMENT)
    render(TrackingSetup)

    expect(await screen.findByText('Upgrade required')).toBeVisible()
  })

  it('the one-click test event shows what was captured, the decision, and the click ids', async () => {
    const fetchMock = setupFetch({ testEvent: testEventResponse(CONSENT_SUPPRESSED) })
    setEntitlements(TRACKING_ENTITLEMENT)
    render(TrackingSetup)

    fireEvent.click(await screen.findByRole('button', { name: 'Send test event' }))

    // One interaction: captured + resolver decision + click ids, together.
    const result = within(await screen.findByRole('region', { name: 'Test result' }))
    expect(result.getByText('What was captured')).toBeVisible()
    expect(result.getByText('$48.00')).toBeVisible()
    expect(result.getByText('ord-test-1')).toBeVisible()

    // The decision names the denying purpose and the signal source.
    expect(result.getByText(/Upload suppressed by/)).toBeVisible()
    expect(result.getByText('Sale or sharing for cross-context advertising')).toBeVisible()
    expect(result.getByText('Gpc')).toBeVisible()
    expect(result.getByText('us-ca')).toBeVisible()

    expect(result.getByText('Click ids present')).toBeVisible()
    expect(result.getByText('g-abc')).toBeVisible()

    const post = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    )
    expect(String(post?.[0])).toContain('/ads/tracking/test-event')
    const body = JSON.parse(String((post as unknown as [string, RequestInit])[1].body))
    expect(body.event_name).toBe('purchase')
    expect(body.event_id).toBeTruthy()
  })

  it('a permitted test event says uploads are permitted', async () => {
    setupFetch({ testEvent: testEventResponse(CONSENT_ALLOWED) })
    setEntitlements(TRACKING_ENTITLEMENT)
    render(TrackingSetup)

    fireEvent.click(await screen.findByRole('button', { name: 'Send test event' }))

    expect(
      await screen.findByText('Upload permitted — no directive suppresses this event.'),
    ).toBeVisible()
  })

  it('passes axe in the loaded state and with a test-event result rendered', async () => {
    setupFetch({ testEvent: testEventResponse(CONSENT_SUPPRESSED) })
    setEntitlements(TRACKING_ENTITLEMENT)
    const { container } = render(TrackingSetup)

    fireEvent.click(await screen.findByRole('button', { name: 'Send test event' }))
    await screen.findByText('Test result')

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('passes axe in the flag-off disabled state', async () => {
    setupFetch()
    setEntitlements([])
    const { container } = render(TrackingSetup)

    await screen.findByText('Conversion tracking is off')

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
