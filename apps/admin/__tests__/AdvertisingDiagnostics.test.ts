import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Diagnostics from '../src/routes/advertising/Diagnostics.svelte'

/**
 * The conversion-diagnostics screen (TASK-015). The load-bearing assertions
 * are the ones the slice exists for: every taxonomy category renders its
 * own message (exhaustively over the enum), consent- and opt-out-
 * suppressed rows name purpose AND signal source, the health banner keeps
 * suppression share and upload failure ratio as separate figures, a partial
 * success renders each platform independently, and the retry control
 * appears on parked rows and never on directive-suppressed ones.
 */

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
      {
        key: 'meta',
        display_name: 'Meta Ads',
        available: true,
        upgrade_required: false,
        connection_state: 'connected',
      },
      {
        key: 'google_ads',
        display_name: 'Google Ads',
        available: true,
        upgrade_required: false,
        connection_state: 'connected',
      },
    ],
  }
}

function consent(overrides: Record<string, unknown> = {}) {
  return {
    answers: { ads_measurement: 'allowed' },
    jurisdiction: 'jp',
    purposes_asked: ['ads_measurement'],
    resolver_version: '2026-08-01',
    signal_source: 'ui',
    ...overrides,
  }
}

let nextId = 0

function event(overrides: Record<string, unknown> = {}) {
  nextId += 1
  return {
    id: `evt-${nextId}`,
    tenant_id: 'dev-acme',
    event_id: `ev-${nextId}`,
    name: 'purchase',
    occurred_at: '2026-09-05T10:00:00Z',
    click_ids: { gclid: 'g-1' },
    hashed_identifiers: { email: '5f4dcc3b5aa765d6' },
    consent: consent(),
    upload_states: { meta: { status: 'uploaded', attempt_count: 1 } },
    value: { amount_minor: 4800, currency: 'USD' },
    value_source: 'payment_record',
    order_ref: 'ord-1',
    subject_key: { kind: 'tenant_device', device_ref: 'dev-1' },
    ...overrides,
  }
}

/** One event per taxonomy category — the exhaustive-coverage fixtures. */
function taxonomyEvents(): Record<string, unknown>[] {
  return [
    event({
      name: 'consent-missing',
      consent: consent({ answers: { ads_measurement: 'denied' }, signal_source: 'ui' }),
      upload_states: {},
    }),
    event({
      name: 'opted-out',
      consent: consent({ answers: { sale_or_share: 'denied' }, signal_source: 'uoom' }),
      upload_states: {},
    }),
    event({
      name: 'browser-signal',
      consent: consent({ answers: { ads_measurement: 'denied' }, signal_source: 'gpc' }),
      upload_states: {},
    }),
    event({
      name: 'withdrawn-late',
      upload_states: {
        meta: {
          status: 'failed',
          attempt_count: 2,
          reason: 'suppressed_late: consent withdrawn since capture',
        },
      },
    }),
    event({
      name: 'no-click-id',
      click_ids: {},
      upload_states: {
        meta: { status: 'parked', attempts: 5, reason: 'no click id present for platform' },
      },
    }),
    event({
      name: 'token-lapsed',
      upload_states: {
        meta: { status: 'parked', attempts: 3, reason: 'connection has no stored credential' },
      },
    }),
    event({
      name: 'platform-500',
      upload_states: {
        meta: { status: 'parked', attempts: 5, reason: 'platform returned 500' },
      },
    }),
  ]
}

function setupFetch(
  events: Record<string, unknown>[],
  handlers: { retry?: (id: string) => unknown } = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/ads/conversions/')) {
      const id = url.split('/ads/conversions/')[1]?.split('/')[0] ?? ''
      if (url.endsWith('/retry') && init?.method === 'POST') {
        return jsonResponse(handlers.retry ? handlers.retry(id) : events[0])
      }
      const matched = events.find((candidate) => candidate.id === id) ?? events[0]
      return jsonResponse({ captured_at: '2026-09-05T10:00:01Z', event: matched })
    }
    if (url.includes('/ads/conversions')) return jsonResponse(events)
    if (url.includes('/ads/platforms')) return jsonResponse(catalog())
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

async function expandRow(table: HTMLElement, name: string): Promise<HTMLElement> {
  const row = within(table)
    .getAllByRole('row')
    .find((candidate) => within(candidate).queryByText(name))
  expect(row, `row for ${name}`).toBeTruthy()
  within(row!)
    .getByRole('button', { name: `Show full story for ${name}` })
    .click()
  return screen.findByRole('region', { name: `Full story for ${name}` })
}

async function collapseRow(name: string): Promise<void> {
  screen.getByRole('button', { name: `Hide full story for ${name}` }).click()
  await waitFor(() => {
    expect(screen.queryByRole('region', { name: `Full story for ${name}` })).toBeNull()
  })
}

describe('diagnostics — reason taxonomy in plain language', () => {
  it('renders every taxonomy category with its own message — exhaustively over the enum', async () => {
    setupFetch(taxonomyEvents())
    render(Diagnostics)

    const table = await screen.findByRole('table', {
      name: 'Recent conversions with their upload story',
    })

    // One case per category: its own label, its own "what happened", and
    // its own "what you can do" — never a shared generic string.
    const cases: [string, RegExp, RegExp][] = [
      [
        'consent-missing',
        /not been permitted by this visitor/,
        /Nothing to fix — the privacy directive is working/,
      ],
      ['opted-out', /opted out of the sale or sharing/, /an opt-out must be honoured/],
      ['browser-signal', /browser sent a privacy signal/, /a browser signal is binding/],
      [
        'withdrawn-late',
        /withdrew consent after the event was captured/,
        /This event can never be re-sent/,
      ],
      [
        'no-click-id',
        /No platform click identifier arrived/,
        /Check that your ad links carry their click identifiers/,
      ],
      [
        'token-lapsed',
        /authorization has lapsed/,
        /Reconnect the platform on the connections screen/,
      ],
      [
        'platform-500',
        /The platform reported an error while this conversion was being uploaded/,
        /retry it once the cause is fixed/,
      ],
    ]

    for (const [name, what, action] of cases) {
      const region = await expandRow(table, name)
      // A late-suppressed platform state also repeats the category's "what"
      // in its platform section — one message, at least once, never absent.
      expect(within(region).getAllByText(what).length, `${name}: what`).toBeGreaterThan(0)
      expect(within(region).getByText(action), `${name}: action`).toBeTruthy()
      await collapseRow(name)
    }
  })

  it('a consent-suppressed and an opt-out-suppressed row each name the purpose and the signal source', async () => {
    setupFetch(taxonomyEvents().slice(0, 2))
    render(Diagnostics)

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Missing consent')).toBeTruthy()
    expect(within(table).getByText(/Suppressed — Ad measurement \(signal: Ui\)/)).toBeTruthy()
    expect(within(table).getByText('Opted out of sale/share')).toBeTruthy()
    expect(
      within(table).getByText(
        /Suppressed — Sale or sharing for cross-context advertising \(signal: Uoom\)/,
      ),
    ).toBeTruthy()
  })
})

describe('diagnostics — health banner', () => {
  it('shows suppression share and upload failure ratio as separate figures with the split', async () => {
    // 5 events: 2 suppressed (1 missing consent, 1 opted out), 1 of 3
    // attempted currently failing → 40% suppression share, 33% failure ratio.
    setupFetch([
      event({ consent: consent({ answers: { ads_measurement: 'denied' } }), upload_states: {} }),
      event({
        consent: consent({ answers: { sale_or_share: 'denied' }, signal_source: 'uoom' }),
        upload_states: {},
      }),
      event({
        upload_states: {
          meta: { status: 'parked', attempts: 5, reason: 'platform returned 500' },
        },
      }),
      event(),
      event({
        upload_states: {
          google_ads: { status: 'uploaded', attempt_count: 1 },
          meta: { status: 'uploaded', attempt_count: 1 },
        },
      }),
    ])
    render(Diagnostics)

    const banner = await screen.findByRole('region', {
      name: 'Conversion uploads are failing',
    })
    expect(within(banner).getByText('Suppression share')).toBeTruthy()
    expect(within(banner).getByText('Upload failure ratio')).toBeTruthy()
    expect(within(banner).getByText('40%')).toBeTruthy()
    expect(within(banner).getByText('33%')).toBeTruthy()
    // The split: consent-absent and opted-out shown separately in the copy.
    expect(within(banner).getByText(/1 without measurement consent/)).toBeTruthy()
    expect(within(banner).getByText(/1 opted out of sale\/share/)).toBeTruthy()
    expect(within(banner).getByText(/0 browser privacy signal/)).toBeTruthy()
  })

  it('stays hidden on a small clean window', async () => {
    setupFetch([event(), event()])
    render(Diagnostics)

    await screen.findByRole('table')
    expect(screen.queryByText('Conversion uploads are failing')).toBeNull()
    expect(screen.queryByText('Conversion health needs attention')).toBeNull()
  })
})

describe('diagnostics — per-platform states and retry', () => {
  it('a partial success renders both platform states independently, never as one status', async () => {
    setupFetch([
      event({
        upload_states: {
          google_ads: { status: 'uploaded', attempt_count: 1 },
          meta: { status: 'failed', attempt_count: 2, reason: 'platform returned 500' },
        },
      }),
      event({
        consent: consent({ answers: { ads_measurement: 'denied' } }),
        upload_states: {},
      }),
    ])
    render(Diagnostics)

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Google Ads' })).toBeTruthy()
    expect(within(table).getByRole('columnheader', { name: 'Meta Ads' })).toBeTruthy()
    expect(within(table).getByText('Uploaded')).toBeTruthy()
    expect(within(table).getByText('Failed')).toBeTruthy()
    expect(within(table).getByText('Attempts: 2')).toBeTruthy()
    // The suppressed event has no platform states at all — never a blended row.
    expect(within(table).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('the retry control renders on parked rows and never on directive-suppressed rows', async () => {
    setupFetch([
      event({
        upload_states: {
          meta: { status: 'parked', attempts: 5, reason: 'platform returned 500' },
        },
      }),
      event({
        consent: consent({ answers: { ads_measurement: 'denied' } }),
        upload_states: {},
      }),
    ])
    render(Diagnostics)

    const table = await screen.findByRole('table')
    expect(
      within(table).getByRole('button', { name: /^Retry upload\s*:\s*purchase$/ }),
    ).toBeTruthy()
    // Exactly one retry control for the two rows.
    expect(within(table).getAllByRole('button', { name: /Retry upload/ }).length).toBe(1)
  })

  it('retrying a parked row calls the retry endpoint and re-renders the returned event', async () => {
    const parked = event({
      upload_states: {
        meta: { status: 'parked', attempts: 5, reason: 'platform returned 500' },
      },
    })
    const fetchMock = setupFetch([parked], {
      retry: () => ({
        ...parked,
        upload_states: { meta: { status: 'pending', attempt_count: 6 } },
      }),
    })
    render(Diagnostics)

    const table = await screen.findByRole('table')
    within(table)
      .getByRole('button', { name: /^Retry upload\s*:\s*purchase$/ })
      .click()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/retry$/),
        expect.objectContaining({ method: 'POST' }),
      )
    })
    // The row re-rendered from the retry response: pending replaces parked.
    await waitFor(() => {
      expect(within(table).getByText('Pending upload')).toBeTruthy()
    })
  })
})

describe('diagnostics — filters and paused state', () => {
  it('filters rows by outcome', async () => {
    setupFetch([
      event(),
      event({
        consent: consent({ answers: { ads_measurement: 'denied' } }),
        upload_states: {},
      }),
      event({
        upload_states: {
          meta: { status: 'parked', attempts: 5, reason: 'platform returned 500' },
        },
      }),
    ])
    render(Diagnostics)

    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row').length).toBe(4) // header + 3 events

    const filter = screen.getByLabelText('Filter by outcome')
    fireEvent.change(filter, { target: { value: 'suppressed' } })

    await waitFor(() => {
      expect(within(table).getAllByRole('row').length).toBe(2) // header + 1 suppressed
    })
    expect(within(table).getAllByText(/Missing consent/).length).toBe(1)
  })

  it('shows the paused state — not an empty table — when tracking is disabled', async () => {
    setEntitlements([])
    setupFetch([event()])
    render(Diagnostics)

    expect(await screen.findByText('Conversion tracking is paused')).toBeTruthy()
    expect(screen.getByText(/the upload workers stop and events wait in the queue/)).toBeTruthy()
    // Retained events still render below the paused notice.
    await screen.findByRole('table', {
      name: 'Recent conversions with their upload story',
    })
  })
})

describe('diagnostics — a11y and privacy', () => {
  it('passes axe on the table and on an expanded row', async () => {
    setupFetch([
      event({
        upload_states: {
          meta: { status: 'parked', attempts: 5, reason: 'platform returned 500' },
        },
      }),
    ])
    const { container } = render(Diagnostics)

    const table = await screen.findByRole('table')
    const region = await expandRow(table, 'purchase')
    expect(region).toBeTruthy()

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders identifiers as hashes and masks click ids in the expanded story', async () => {
    setupFetch([
      event({
        hashed_identifiers: { email: '5f4dcc3b5aa765d61d8327deb882cf99' },
      }),
    ])
    render(Diagnostics)

    const table = await screen.findByRole('table')
    const region = await expandRow(table, 'purchase')
    expect(within(region).getByText(/5f4dcc3b5aa765d61d8327deb882cf99/)).toBeTruthy()
    // The click id is masked: ellipsis + last two characters, never the raw value.
    expect(within(region).getByText(/…-1/)).toBeTruthy()
  })
})
