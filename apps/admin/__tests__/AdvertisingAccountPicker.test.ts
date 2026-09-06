import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AccountPicker from '../src/routes/advertising/AccountPicker.svelte'
import {
  clearPendingAdConnection,
  setPendingAdConnection,
} from '../src/lib/advertising-connect.svelte'

/**
 * The account picker route (TASK-011): picks the ad account from the
 * pending connection's list and declares currency + timezone. The pending
 * connection travels in module state, so tests seed it directly.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const ACCOUNTS = [
  { external_id: '123-456', display_name: 'Tokyo Retail' },
  { external_id: '789-000', display_name: 'Osaka Wholesale' },
]

function seedPending(): void {
  setPendingAdConnection({
    platform: 'meta',
    connectionId: 'conn_pending_9',
    accounts: ACCOUNTS,
    redeemedAt: Date.now(),
  })
}

beforeEach(() => {
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setEntitlements([])
  setSession({
    userId: 'usr_1',
    email: 'owner@example.com',
    emailVerified: true,
    status: 'active',
    memberships: [],
    aal: 'aal2',
    methods: ['totp'],
    authenticatedAt: new Date().toISOString(),
    locale: 'en',
  })
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  clearPendingAdConnection()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  setSession(null)
})

describe('Advertising account picker route (phase 10, TASK-011)', () => {
  it('renders the restart state when there is no pending connection (reload, expired, or deep link)', async () => {
    render(AccountPicker, { props: { platform: 'meta' } })

    expect(
      await screen.findByText(/This connection attempt has expired or was already completed/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to connections' })).toBeInTheDocument()
  })

  it('finalizes the connection with the pending id, chosen account, currency, and timezone', async () => {
    seedPending()
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/v1/tenant/ads/connections') && init?.method === 'POST') {
        return jsonResponse({
          id: 'conn_live_1',
          platform: 'meta',
          external_account_id: '123-456',
          account_name: 'Tokyo Retail',
          currency: 'JPY',
          timezone: 'Asia/Tokyo',
          status: 'active',
          health: {
            can_sync: true,
            can_upload_conversions: true,
            scopes_missing: [],
            reconnect_required: false,
          },
        })
      }
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    render(AccountPicker, { props: { platform: 'meta' } })

    fireEvent.click(await screen.findByRole('radio', { name: /Tokyo Retail/ }))
    fireEvent.input(screen.getByLabelText(/Account currency \(Tokyo Retail\)/), {
      target: { value: 'jpy' },
    })
    fireEvent.input(screen.getByLabelText(/Account timezone \(Tokyo Retail\)/), {
      target: { value: 'Asia/Tokyo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Connect this account' }))

    await waitFor(() => {
      const createCall = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input).endsWith('/api/v1/tenant/ads/connections') && init?.method === 'POST',
      )
      expect(createCall).toBeDefined()
    })
    const [, createInit] = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith('/api/v1/tenant/ads/connections') && init?.method === 'POST',
    )!
    expect(JSON.parse(String(createInit?.body))).toEqual({
      connection_id: 'conn_pending_9',
      external_account_id: '123-456',
      currency: 'JPY',
      timezone: 'Asia/Tokyo',
    })
    // Success lands back on the connections screen.
    await waitFor(() => expect(window.location.pathname).toBe('/advertising/connections'))
  })

  it('explains a 400 as "that account is no longer offered" instead of a generic failure', async () => {
    seedPending()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              type: 'about:blank',
              title: 'Bad request',
              status: 400,
            }),
            { status: 400, headers: { 'content-type': 'application/problem+json' } },
          ),
      ),
    )

    render(AccountPicker, { props: { platform: 'meta' } })

    fireEvent.click(await screen.findByRole('radio', { name: /Tokyo Retail/ }))
    fireEvent.input(screen.getByLabelText(/Account currency \(Tokyo Retail\)/), {
      target: { value: 'JPY' },
    })
    fireEvent.input(screen.getByLabelText(/Account timezone \(Tokyo Retail\)/), {
      target: { value: 'Asia/Tokyo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Connect this account' }))

    expect(
      await screen.findByText(/no longer among the ones the platform offered/),
    ).toBeInTheDocument()
    // Still on the picker — the pending connection was not consumed.
    expect(window.location.pathname).toBe('/')
  })

  it('passes axe on the restart state and the picker', async () => {
    const restart = render(AccountPicker, { props: { platform: 'meta' } })
    await screen.findByText(/This connection attempt has expired/)
    expect(await axe(restart.container)).toHaveNoViolations()
    restart.unmount()

    seedPending()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({})),
    )
    const picker = render(AccountPicker, { props: { platform: 'meta' } })
    await screen.findByRole('radio', { name: /Tokyo Retail/ })
    expect(await axe(picker.container)).toHaveNoViolations()
  })
})
