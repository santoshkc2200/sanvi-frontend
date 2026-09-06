import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Connections from '../src/routes/advertising/Connections.svelte'
import { getToasts } from '@sanvi/ui'
import {
  AD_PLATFORM_FIXTURES,
  fixturePlatformByKey,
  platformViewFixture,
} from '@sanvi/ui/test-fixtures'

/**
 * The advertising connections screen (TASK-011) — the OAuth handoff, the
 * health states, and the disconnect dialog. Fetch is stubbed at the HTTP
 * boundary (the PaymentsSettings tests' approach), so the whole
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

function problemResponse(status: number): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title: 'Error', status }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
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

function catalog() {
  return {
    platforms: [
      platformViewFixture(GOOGLE, { connection_state: 'connected' }),
      platformViewFixture(META),
    ] as unknown as PlatformsShape,
  }
}

type PlatformsShape = { platforms: ReturnType<typeof platformViewFixture>[] }

const assign = vi.fn()
const ORIGINAL_LOCATION = window.location

function stubLocation(search = ''): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'http://localhost:4175',
      pathname: '/advertising/connections',
      search,
      assign,
    },
  })
}

function setFreshSession(): void {
  setSession({
    userId: 'usr_1',
    email: 'owner@example.com',
    emailVerified: true,
    status: 'active',
    memberships: [],
    aal: 'aal2',
    methods: ['totp'],
    authenticatedAt: new Date().toISOString(), // inside the 300s freshness window
    locale: 'en',
  })
}

function setStaleSession(): void {
  setSession({
    userId: 'usr_1',
    email: 'owner@example.com',
    emailVerified: true,
    status: 'active',
    memberships: [],
    aal: 'aal1',
    methods: ['password'],
    authenticatedAt: '2026-08-01T00:00:00Z',
    locale: 'en',
  })
}

/** Routes the advertising API regardless of which origin the app is configured against. */
function advertisingResponse(url: string, connections: unknown[]): Response {
  if (url.includes('/ads/platforms')) return jsonResponse(catalog())
  if (url.includes('/oauth/start')) {
    return jsonResponse({
      authorization_url: 'https://accounts.example.test/oauth/authorize?state=abc',
      state: 'abc',
    })
  }
  if (url.endsWith('/api/v1/tenant/ads/connections')) {
    return jsonResponse({ connections })
  }
  return jsonResponse({})
}

/** Installs the standard two-platform catalog with one healthy connection. */
function setupStandardFetch(options: { connections?: unknown[] } = {}): ReturnType<typeof vi.fn> {
  const connections = options.connections ?? [connection()]
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
    advertisingResponse(String(input), connections),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  stubLocation()
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setEntitlements([])
  setLocale('en')
  setFreshSession()
})

afterEach(() => {
  // Components leak across tests otherwise: a mounted screen from one test
  // still consumes the next test's fetch stub and its `screen` queries see
  // two DOM copies.
  cleanup()
  Object.defineProperty(window, 'location', { configurable: true, value: ORIGINAL_LOCATION })
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  setSession(null)
})

describe('AdvertisingConnections screen (phase 10, TASK-011)', () => {
  it('renders the connected platform with its health, summary, and disconnect; the other with a pre-connect explainer and Connect CTA', async () => {
    setupStandardFetch()
    render(Connections)

    const googleCard = (await screen.findByRole('heading', { name: GOOGLE.display_name })).closest(
      'article',
    ) as HTMLElement
    expect(within(googleCard).getByText('Connected')).toBeInTheDocument()
    expect(within(googleCard).getByText(/Last synced/)).toBeInTheDocument()
    expect(screen.getByText(/Tokyo Retail · JPY · Asia\/Tokyo/)).toBeInTheDocument()

    const metaCard = screen
      .getByRole('heading', { name: META.display_name })
      .closest('article') as HTMLElement
    expect(
      within(metaCard).getByText(
        /Connecting lets Sanvi read this platform's campaign data and act on your behalf\./,
      ),
    ).toBeInTheDocument()
    expect(within(metaCard).getByRole('button', { name: 'Connect' })).toBeInTheDocument()
  })

  it("labels a live connection's CTA as connecting a different account — reconnecting stays on the health action", async () => {
    setupStandardFetch()
    render(Connections)

    const googleCard = (await screen.findByRole('heading', { name: GOOGLE.display_name })).closest(
      'article',
    ) as HTMLElement
    expect(
      within(googleCard).getByRole('button', { name: 'Connect a different account' }),
    ).toBeInTheDocument()
  })

  it('renders each health state with its own message and its single fixing action', async () => {
    const cases = [
      {
        overrides: {
          health: { ...HEALTH, can_sync: false, last_error: 'quota exceeded' },
        },
        badge: 'Sync failing',
        message: /quota exceeded/,
        action: 'Reconnect (keeps campaign history)',
      },
      {
        overrides: {
          health: { ...HEALTH, reconnect_required: true },
        },
        badge: 'Reconnect required',
        message: /sign-in was revoked or expired/,
        action: 'Reconnect (keeps campaign history)',
      },
      {
        overrides: {
          health: {
            ...HEALTH,
            scopes_missing: ['ads.manage'],
            can_upload_conversions: false,
          },
        },
        badge: 'Re-consent required',
        message: /Create and edit campaigns and budgets on your behalf/,
        action: 'Reconnect (keeps campaign history)',
      },
      {
        overrides: {
          health: {
            ...HEALTH,
            token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        },
        badge: 'Sign-in expiring',
        message: /expires on/,
        action: 'Reconnect (keeps campaign history)',
      },
      {
        overrides: { status: 'disconnected' },
        badge: 'Disconnected',
        message: /Campaigns keep running on the platform/,
      },
    ] as const

    for (const testCase of cases) {
      setupStandardFetch({ connections: [connection(testCase.overrides)] })
      const { unmount } = render(Connections)

      const card = (await screen.findByRole('heading', { name: GOOGLE.display_name })).closest(
        'article',
      ) as HTMLElement
      expect(within(card).getByText(testCase.badge)).toBeInTheDocument()
      if (testCase.message) {
        expect(within(card).getAllByText(testCase.message).length).toBeGreaterThan(0)
      }
      if (testCase.action) {
        expect(within(card).getByRole('button', { name: testCase.action })).toBeInTheDocument()
      }
      unmount()
      vi.clearAllMocks()
    }
  })

  it('re-consent names the missing scope with its plain-language explanation and what stopped', async () => {
    setupStandardFetch({
      connections: [
        connection({
          health: {
            ...HEALTH,
            scopes_missing: ['ads.manage'],
            can_upload_conversions: false,
          },
        }),
      ],
    })
    render(Connections)

    const card = (await screen.findByRole('heading', { name: GOOGLE.display_name })).closest(
      'article',
    ) as HTMLElement
    expect(within(card).getByText('Permissions that stopped working')).toBeInTheDocument()
    expect(
      within(card).getByText('Create and edit campaigns and budgets on your behalf'),
    ).toBeInTheDocument()
    expect(within(card).getByText(/Conversion uploads have stopped\./)).toBeInTheDocument()
  })

  it("starts the OAuth handoff: POST with this app's callback as redirect_uri, then navigates to the returned URL verbatim", async () => {
    const fetchMock = setupStandardFetch({ connections: [] })
    render(Connections)

    const metaCard = (await screen.findByRole('heading', { name: META.display_name })).closest(
      'article',
    ) as HTMLElement
    await fireEvent.click(within(metaCard).getByRole('button', { name: 'Connect' }))

    await waitFor(() => {
      const startCall = fetchMock.mock.calls.find(([input]) =>
        String(input).includes('/oauth/start'),
      )
      expect(startCall).toBeDefined()
    })
    const [startUrl, startInit] = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/oauth/start'),
    )!
    expect(startUrl).toContain(`/ads/connections/${META.key}/oauth/start`)
    expect(JSON.parse(String(startInit?.body))).toEqual({
      redirect_uri: `http://localhost:4175/advertising/connect/${META.key}/callback`,
    })
    expect(assign).toHaveBeenCalledWith('https://accounts.example.test/oauth/authorize?state=abc')
  })

  it("shows a disconnected account's fresh Connect rather than a reconnect (they disconnected it deliberately)", async () => {
    setupStandardFetch({ connections: [connection({ status: 'disconnected' })] })
    render(Connections)

    const googleCard = (await screen.findByRole('heading', { name: GOOGLE.display_name })).closest(
      'article',
    ) as HTMLElement
    expect(within(googleCard).getByText('Disconnected')).toBeInTheDocument()
    expect(within(googleCard).getByRole('button', { name: 'Connect' })).toBeInTheDocument()
    expect(within(googleCard).queryByRole('button', { name: /Reconnect/ })).not.toBeInTheDocument()
  })

  it('disconnect requires the typed phrase, states the spending consequence above the fold, and deletes on confirm', async () => {
    const fetchMock = setupStandardFetch()
    render(Connections)

    await fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))

    // Above the fold, its own line: the platform keeps spending.
    expect(
      await screen.findByText('Your campaigns keep running on the platform and keep spending.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Metrics stop updating in Sanvi.')).toBeInTheDocument()
    expect(screen.getByText('Conversion uploads stop.')).toBeInTheDocument()

    const confirm = screen.getByRole('button', { name: 'Disconnect account' })
    expect(confirm).toBeDisabled()

    await fireEvent.input(screen.getByLabelText(/Type DISCONNECT/), {
      target: { value: 'DISCONNECT' },
    })
    expect(confirm).toBeEnabled()
    await fireEvent.click(confirm)

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input).includes('/ads/connections/conn_google_1') && init?.method === 'DELETE',
      )
      expect(deleteCall).toBeDefined()
    })
  })

  it('routes a stale session to step-up before submitting the disconnect', async () => {
    setupStandardFetch()
    setStaleSession()
    render(Connections)

    await fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))

    // The dialog's step-up leg: consequences stay put, the confirm becomes
    // the re-authentication it requires — and no DELETE is even offered.
    expect(await screen.findByText(/needs a fresh sign-in confirmation/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Re-authenticate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disconnect account' })).not.toBeInTheDocument()
  })

  it('resumes a disconnect from the step-up return (?disconnect=<id> reopens the dialog)', async () => {
    setupStandardFetch()
    stubLocation('?disconnect=conn_google_1')
    const replaceState = vi.spyOn(window.history, 'replaceState')
    render(Connections)

    expect(
      await screen.findByText('Your campaigns keep running on the platform and keep spending.'),
    ).toBeInTheDocument()
    // The closed <dialog> keeps its content in the DOM (a11y-hidden), so
    // the text alone can match early — wait for the dialog to actually
    // open, which happens once the catalog+connections load resolves.
    expect(await screen.findByRole('button', { name: 'Disconnect account' })).toBeInTheDocument()
    // The return_to has been consumed — a refresh cannot re-trigger it.
    expect(replaceState).toHaveBeenCalledWith(null, '', '/advertising/connections')
  })

  it('resumes a connect from the step-up return (?connect=<key> starts the handoff)', async () => {
    const fetchMock = setupStandardFetch({ connections: [] })
    stubLocation(`?connect=${META.key}`)
    render(Connections)

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://accounts.example.test/oauth/authorize?state=abc')
    })
    const [, startInit] = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/oauth/start'),
    )!
    expect(JSON.parse(String(startInit?.body))).toEqual({
      redirect_uri: `http://localhost:4175/advertising/connect/${META.key}/callback`,
    })
  })

  it('keeps an existing connection listed when its platform flag is off (unavailable card)', async () => {
    setupStandardFetch({
      connections: [connection()],
    })
    const flaggedCatalog = {
      platforms: [
        platformViewFixture(GOOGLE, { connection_state: 'connected', available: false }),
        platformViewFixture(META),
      ] as unknown as PlatformsShape,
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/ads/platforms')) return jsonResponse(flaggedCatalog)
      if (url.includes('/oauth/start')) return problemResponse(503)
      if (url.endsWith('/api/v1/tenant/ads/connections')) {
        return jsonResponse({ connections: [connection()] })
      }
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)
    render(Connections)

    const googleCard = (await screen.findByRole('heading', { name: GOOGLE.display_name })).closest(
      'article',
    ) as HTMLElement
    expect(within(googleCard).getByText('Unavailable')).toBeInTheDocument()
    // The connection is not presented as gone.
    expect(within(googleCard).getByText(/Last synced/)).toBeInTheDocument()
  })

  it('renders Japanese copy for health states and the disconnect dialog', async () => {
    const { setLocale } = await import('@sanvi/i18n')
    setupStandardFetch()
    setLocale('ja')
    render(Connections)

    const googleCard = (await screen.findByRole('heading', { name: GOOGLE.display_name })).closest(
      'article',
    ) as HTMLElement
    expect(within(googleCard).getByText('正常')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '接続を解除' })).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: '接続を解除' }))
    expect(
      await screen.findByText(
        'キャンペーンはプラットフォーム上で実行され続け、費用も発生し続けます。',
      ),
    ).toBeInTheDocument()
  })

  it('falls back to the page UpgradePrompt when the flag is off (404 catalog)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => problemResponse(404)),
    )
    render(Connections)
    expect(await screen.findByText('Upgrade required')).toBeInTheDocument()
  })

  it('loads no external ad-platform script on any render path', async () => {
    setupStandardFetch()
    const { container, unmount } = render(Connections)
    await screen.findByRole('heading', { name: GOOGLE.display_name })
    expect(Array.from(container.querySelectorAll('script[src]'))).toEqual([])
    expect(container.outerHTML).not.toMatch(/accounts\.google\.com|facebook\.com|fbcdn/)
    unmount()
  })

  it('passes axe on the catalog view and the disconnect dialog', async () => {
    setupStandardFetch()
    const { container } = render(Connections)
    await screen.findByRole('heading', { name: GOOGLE.display_name })
    expect(await axe(container)).toHaveNoViolations()

    await fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    await screen.findByText('Your campaigns keep running on the platform and keep spending.')
    // The dialog renders into a portal on document.body — assert axe on the
    // whole document rather than the detached container.
    expect(await axe(document.body)).toHaveNoViolations()
  })

  it('renders every fixture platform without per-platform code', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/ads/platforms')) {
        return jsonResponse({
          platforms: AD_PLATFORM_FIXTURES.map((fixture) => platformViewFixture(fixture)),
        })
      }
      if (url.endsWith('/api/v1/tenant/ads/connections')) {
        return jsonResponse({ connections: [] })
      }
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)
    render(Connections)

    for (const fixture of AD_PLATFORM_FIXTURES) {
      expect(await screen.findByRole('heading', { name: fixture.display_name })).toBeInTheDocument()
    }
  })

  it('prefers the active connection when a platform has multiple rows with disconnected one first', async () => {
    const disconnectedRow = connection({
      id: 'conn_google_old',
      account_name: 'Tokyo Retail Old',
      status: 'disconnected',
    })
    const activeRow = connection({
      id: 'conn_google_active',
      account_name: 'Tokyo Retail Active',
      status: 'active',
      health: { ...HEALTH },
    })

    setupStandardFetch({ connections: [disconnectedRow, activeRow] })
    render(Connections)

    const googleCard = (await screen.findByRole('heading', { name: GOOGLE.display_name })).closest(
      'article',
    ) as HTMLElement

    // Active row is selected: healthy badge, not Disconnected
    expect(within(googleCard).getByText('Healthy')).toBeInTheDocument()
    expect(within(googleCard).queryByText('Disconnected')).not.toBeInTheDocument()
    expect(screen.getByText(/Tokyo Retail Active/)).toBeInTheDocument()
    expect(screen.queryByText(/Tokyo Retail Old/)).not.toBeInTheDocument()
  })

  it('shows permission denied toast on 403 when session is fresh and does not redirect to step-up', async () => {
    setFreshSession()
    const pushState = vi.spyOn(window.history, 'pushState')
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/ads/platforms')) return jsonResponse(catalog())
      if (url.includes('/oauth/start')) return problemResponse(403)
      if (url.endsWith('/api/v1/tenant/ads/connections')) return jsonResponse({ connections: [] })
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)
    render(Connections)

    const metaCard = (await screen.findByRole('heading', { name: META.display_name })).closest(
      'article',
    ) as HTMLElement
    await fireEvent.click(within(metaCard).getByRole('button', { name: 'Connect' }))

    await waitFor(() => {
      expect(
        getToasts().some((t) =>
          t.title.includes('You do not have permission to connect advertising platforms'),
        ),
      ).toBe(true)
    })
    expect(pushState).not.toHaveBeenCalledWith(
      expect.anything(),
      '',
      expect.stringContaining('/step-up'),
    )
  })

  it('keeps disconnect dialog open and shows permission denied error on 403 when session is fresh', async () => {
    setFreshSession()
    const pushState = vi.spyOn(window.history, 'pushState')
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/ads/platforms')) return jsonResponse(catalog())
      if (url.includes('/ads/connections') && init?.method === 'DELETE') {
        return problemResponse(403)
      }
      if (url.endsWith('/api/v1/tenant/ads/connections')) {
        return jsonResponse({ connections: [connection()] })
      }
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)
    render(Connections)

    await fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))
    await fireEvent.input(screen.getByLabelText(/Type DISCONNECT/), {
      target: { value: 'DISCONNECT' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Disconnect account' }))

    expect(
      await screen.findByText('You do not have permission to disconnect advertising connections.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disconnect account' })).toBeInTheDocument()
    expect(pushState).not.toHaveBeenCalledWith(
      expect.anything(),
      '',
      expect.stringContaining('/step-up'),
    )
  })

  it('shows error toast when resuming an unknown platform connect', async () => {
    setupStandardFetch({ connections: [] })
    stubLocation('?connect=nonexistent_platform')
    render(Connections)

    await waitFor(() => {
      expect(
        getToasts().some((t) => t.title.includes('Could not resume connecting to the platform')),
      ).toBe(true)
    })
  })

  it('shows error toast when resuming a nonexistent connection disconnect', async () => {
    setupStandardFetch({ connections: [] })
    stubLocation('?disconnect=conn_nonexistent')
    render(Connections)

    await waitFor(() => {
      expect(
        getToasts().some((t) => t.title.includes('Could not resume disconnecting the account')),
      ).toBe(true)
    })
  })
})
