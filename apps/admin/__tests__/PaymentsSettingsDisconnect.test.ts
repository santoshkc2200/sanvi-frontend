import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PaymentsSettings from '../src/routes/PaymentsSettings.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function problemResponse(problem: Record<string, unknown>, status = 409): Response {
  return new Response(JSON.stringify(problem), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  })
}

const STRIPE_PROVIDER = {
  kind: 'stripe_connect',
  display_name: 'Stripe',
  available: true,
  requires_onboarding: true,
  supported_countries: ['US', 'JP', 'GB', 'DE'],
}

const ACTIVE_CONNECTION = {
  id: 'conn_active_123',
  provider: 'stripe_connect',
  status: 'active',
  capabilities: {
    card_payments: 'active',
    transfers: 'active',
  },
  requirements: {
    currently_due: [],
    eventually_due: [],
    past_due: [],
    deadline: null,
  },
  blockers: [],
  country: 'US',
  default_currency: 'USD',
  connected_at: '2026-08-20T10:00:00Z',
  last_synced_at: '2026-08-20T10:05:00Z',
  can_accept_payments: true,
}

const MOCK_PAYOUTS = [
  {
    amount_minor: 50000,
    arrival_at: '2026-08-25T10:00:00Z',
    currency: 'USD',
    external_payout_id: 'po_stripe_1',
    status: 'paid',
  },
]

const HEALTHY_TAX_SETTINGS = {
  active_registrations: 2,
  disclaimer: 'Tax registration and remittance is merchant responsibility.',
  enabled: true,
  last_checked_at: '2026-08-28T12:00:00Z',
  liability_account: 'acct_stripe_123',
  platform_fee: {
    basis_points: 290,
    enabled: true,
    fixed_currency: 'USD',
    fixed_minor: 30,
    minimum_minor: 50,
  },
  provider_status: 'active',
  warning: null,
}

describe('PaymentsSettings - Disconnect Flow and Degraded Mode (TASK-008)', () => {
  beforeEach(() => {
    localStorage.clear()
    setSession({
      userId: 'usr_1',
      email: 'admin@example.com',
      emailVerified: true,
      status: 'active',
      memberships: [
        {
          tenant_id: 'dev-acme',
          tenant_slug: 'acme',
          tenant_name: 'Acme',
          role_id: 'owner',
          permissions: ['payments.read', 'payments.manage'],
        },
      ],
      aal: 'aal1',
      methods: ['password'],
      authenticatedAt: '2026-08-01T00:00:00Z',
      locale: 'en',
    })
    setMemberships([
      {
        tenantId: 'dev-acme',
        slug: 'acme',
        displayName: 'Acme',
        role: 'owner',
        permissions: ['payments.read', 'payments.manage'],
      },
    ])
    switchTenant('dev-acme')
    setEntitlements([{ feature: 'payments.stripe_connect', enabled: true }])
    localStorage.setItem('sanvi:payments:connection:dev-acme', 'conn_active_123')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  function setupStandardFetch(
    overrideHandler?: (url: string, init?: RequestInit) => Response | undefined,
  ) {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (overrideHandler) {
        const custom = overrideHandler(url, init)
        if (custom) return Promise.resolve(custom)
      }
      if (url.includes('/tenant/payments/providers')) {
        return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
      }
      if (url.includes('/tenant/payments/connections/conn_active_123')) {
        return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
      }
      if (url.includes('/tenant/payments/payouts')) {
        return Promise.resolve(jsonResponse({ payouts: MOCK_PAYOUTS }))
      }
      if (url.includes('/tenant/payments/tax-settings')) {
        return Promise.resolve(jsonResponse(HEALTHY_TAX_SETTINGS))
      }
      return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('renders disconnect section and requires exact typed phrase to confirm', async () => {
    let deleteCalled = false
    let deleteHeaders: HeadersInit | undefined
    setupStandardFetch((url, init) => {
      if (
        url.includes('/tenant/payments/connections/conn_active_123') &&
        init?.method === 'DELETE'
      ) {
        deleteCalled = true
        deleteHeaders = init.headers
        return jsonResponse({
          ...ACTIVE_CONNECTION,
          status: 'disconnected',
          can_accept_payments: false,
        })
      }
      return undefined
    })

    render(PaymentsSettings)

    // Find Disconnect section and click button
    const disconnectBtn = await screen.findByRole('button', { name: 'Disconnect provider' })
    expect(disconnectBtn).toBeInTheDocument()
    await fireEvent.click(disconnectBtn)

    // Confirmation dialog is open
    expect(
      await screen.findByRole('heading', { name: 'Disconnect payment provider' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Checkout stops immediately on your storefront.')).toBeInTheDocument()
    expect(
      screen.getByText('Existing payments, refunds, and payouts are unaffected and retained.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your Stripe account remains yours. Sanvi never held your money or account.',
      ),
    ).toBeInTheDocument()

    // Confirm button in dialog is initially disabled
    const confirmButtons = screen.getAllByRole('button', { name: 'Disconnect provider' })
    const dialogConfirmBtn = confirmButtons[confirmButtons.length - 1]
    expect(dialogConfirmBtn).toBeDisabled()

    // Type incorrect phrase
    const input = screen.getByPlaceholderText('Type DISCONNECT to confirm')
    await fireEvent.input(input, { target: { value: 'DIS' } })
    expect(dialogConfirmBtn).toBeDisabled()

    // Type correct phrase
    await fireEvent.input(input, { target: { value: 'DISCONNECT' } })
    expect(dialogConfirmBtn).not.toBeDisabled()

    // Confirm disconnection
    await fireEvent.click(dialogConfirmBtn)

    await waitFor(() => {
      expect(deleteCalled).toBe(true)
    })
    expect(deleteHeaders).toBeDefined()
    expect((deleteHeaders as Record<string, string>)['idempotency-key']).toBeDefined()
  })

  it('disables disconnect button when user lacks payments.manage permission', async () => {
    setSession({
      userId: 'usr_viewer',
      email: 'viewer@example.com',
      emailVerified: true,
      status: 'active',
      memberships: [
        {
          tenant_id: 'dev-acme',
          tenant_slug: 'acme',
          tenant_name: 'Acme',
          role_id: 'viewer',
          permissions: ['payments.read'],
        },
      ],
      aal: 'aal1',
      methods: ['password'],
      authenticatedAt: '2026-08-01T00:00:00Z',
      locale: 'en',
    })
    setMemberships([
      {
        tenantId: 'dev-acme',
        slug: 'acme',
        displayName: 'Acme',
        role: 'viewer',
        permissions: ['payments.read'],
      },
    ])

    setupStandardFetch()

    render(PaymentsSettings)

    const disconnectBtn = await screen.findByRole('button', { name: 'Disconnect provider' })
    expect(disconnectBtn).toBeDisabled()
    expect(
      screen.getByText('You do not have permission to disconnect payment providers.'),
    ).toBeInTheDocument()
  })

  it('re-uses the exact same idempotency key on retry after a transient failure', async () => {
    let callCount = 0
    const keys: string[] = []
    setupStandardFetch((url, init) => {
      if (
        url.includes('/tenant/payments/connections/conn_active_123') &&
        init?.method === 'DELETE'
      ) {
        callCount++
        const headers = init.headers as Record<string, string>
        if (headers?.['idempotency-key']) {
          keys.push(headers['idempotency-key'])
        }
        return problemResponse(
          {
            type: 'payments/invalid-request',
            title: 'Invalid request',
            status: 400,
          },
          400,
        )
      }
      return undefined
    })

    render(PaymentsSettings)

    const disconnectBtn = await screen.findByRole('button', { name: 'Disconnect provider' })
    await fireEvent.click(disconnectBtn)

    const input = await screen.findByPlaceholderText('Type DISCONNECT to confirm')
    await fireEvent.input(input, { target: { value: 'DISCONNECT' } })

    const confirmButtons = screen.getAllByRole('button', { name: 'Disconnect provider' })
    const dialogConfirmBtn = confirmButtons[confirmButtons.length - 1]

    // First attempt (fails with 400)
    await fireEvent.click(dialogConfirmBtn)

    await waitFor(() => {
      expect(callCount).toBe(1)
    })
    expect(await screen.findByText('Invalid request')).toBeInTheDocument()

    // Second attempt (retry)
    await fireEvent.click(dialogConfirmBtn)

    await waitFor(() => {
      expect(callCount).toBe(2)
    })

    expect(keys.length).toBe(2)
    expect(keys[0]).toBe(keys[1])
  })

  it('displays specific translated message when disconnect is blocked by in_flight_payments', async () => {
    setupStandardFetch((url, init) => {
      if (
        url.includes('/tenant/payments/connections/conn_active_123') &&
        init?.method === 'DELETE'
      ) {
        return problemResponse(
          {
            type: 'payments/disconnect-blocked',
            title: 'Disconnect blocked',
            status: 409,
            blockers: [
              {
                code: 'in_flight_payments',
                summary_key: 'payments.blocker.in_flight_payments',
              },
            ],
          },
          409,
        )
      }
      return undefined
    })

    render(PaymentsSettings)

    const disconnectBtn = await screen.findByRole('button', { name: 'Disconnect provider' })
    await fireEvent.click(disconnectBtn)

    const input = await screen.findByPlaceholderText('Type DISCONNECT to confirm')
    await fireEvent.input(input, { target: { value: 'DISCONNECT' } })

    const confirmButtons = screen.getAllByRole('button', { name: 'Disconnect provider' })
    await fireEvent.click(confirmButtons[confirmButtons.length - 1])

    expect(await screen.findByText('Cannot disconnect payment provider')).toBeInTheDocument()
    expect(
      screen.getByText(
        'A payment is still being processed — wait for it to complete before disconnecting',
      ),
    ).toBeInTheDocument()
  })

  it('displays specific translated message when disconnect is blocked by open_disputes', async () => {
    setupStandardFetch((url, init) => {
      if (
        url.includes('/tenant/payments/connections/conn_active_123') &&
        init?.method === 'DELETE'
      ) {
        return problemResponse(
          {
            type: 'payments/disconnect-blocked',
            title: 'Disconnect blocked',
            status: 409,
            blockers: [
              {
                code: 'open_disputes',
                summary_key: 'payments.blocker.open_disputes',
              },
            ],
          },
          409,
        )
      }
      return undefined
    })

    render(PaymentsSettings)

    const disconnectBtn = await screen.findByRole('button', { name: 'Disconnect provider' })
    await fireEvent.click(disconnectBtn)

    const input = await screen.findByPlaceholderText('Type DISCONNECT to confirm')
    await fireEvent.input(input, { target: { value: 'DISCONNECT' } })

    const confirmButtons = screen.getAllByRole('button', { name: 'Disconnect provider' })
    await fireEvent.click(confirmButtons[confirmButtons.length - 1])

    expect(await screen.findByText('Cannot disconnect payment provider')).toBeInTheDocument()
    expect(
      screen.getByText('A dispute needs your response — resolve it before disconnecting'),
    ).toBeInTheDocument()
  })

  it('displays specific translated message when disconnect is blocked by pending_payouts', async () => {
    setupStandardFetch((url, init) => {
      if (
        url.includes('/tenant/payments/connections/conn_active_123') &&
        init?.method === 'DELETE'
      ) {
        return problemResponse(
          {
            type: 'payments/disconnect-blocked',
            title: 'Disconnect blocked',
            status: 409,
            blockers: [
              {
                code: 'pending_payouts',
                summary_key: 'payments.blocker.pending_payouts',
              },
            ],
          },
          409,
        )
      }
      return undefined
    })

    render(PaymentsSettings)

    const disconnectBtn = await screen.findByRole('button', { name: 'Disconnect provider' })
    await fireEvent.click(disconnectBtn)

    const input = await screen.findByPlaceholderText('Type DISCONNECT to confirm')
    await fireEvent.input(input, { target: { value: 'DISCONNECT' } })

    const confirmButtons = screen.getAllByRole('button', { name: 'Disconnect provider' })
    await fireEvent.click(confirmButtons[confirmButtons.length - 1])

    expect(await screen.findByText('Cannot disconnect payment provider')).toBeInTheDocument()
    expect(
      screen.getByText('A payout to your bank is still pending — let it arrive or fail first'),
    ).toBeInTheDocument()
  })

  it('renders all returned blockers as distinct lines when multiple exist', async () => {
    setupStandardFetch((url, init) => {
      if (
        url.includes('/tenant/payments/connections/conn_active_123') &&
        init?.method === 'DELETE'
      ) {
        return problemResponse(
          {
            type: 'payments/disconnect-blocked',
            title: 'Disconnect blocked',
            status: 409,
            blockers: [
              {
                code: 'in_flight_payments',
                summary_key: 'payments.blocker.in_flight_payments',
              },
              {
                code: 'open_disputes',
                summary_key: 'payments.blocker.open_disputes',
              },
              {
                code: 'pending_payouts',
                summary_key: 'payments.blocker.pending_payouts',
              },
            ],
          },
          409,
        )
      }
      return undefined
    })

    render(PaymentsSettings)

    const disconnectBtn = await screen.findByRole('button', { name: 'Disconnect provider' })
    await fireEvent.click(disconnectBtn)

    const input = await screen.findByPlaceholderText('Type DISCONNECT to confirm')
    await fireEvent.input(input, { target: { value: 'DISCONNECT' } })

    const confirmButtons = screen.getAllByRole('button', { name: 'Disconnect provider' })
    await fireEvent.click(confirmButtons[confirmButtons.length - 1])

    expect(await screen.findByText('Cannot disconnect payment provider')).toBeInTheDocument()
    expect(
      screen.getByText(
        'A payment is still being processed — wait for it to complete before disconnecting',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('A dispute needs your response — resolve it before disconnecting'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('A payout to your bank is still pending — let it arrive or fail first'),
    ).toBeInTheDocument()
  })

  it('shows degraded mode notice when getPaymentConnection returns payments/provider-unavailable', async () => {
    setupStandardFetch((url) => {
      if (url.includes('/tenant/payments/connections/conn_active_123')) {
        return problemResponse(
          {
            type: 'payments/provider-unavailable',
            title: 'Stripe unavailable',
            status: 502,
          },
          502,
        )
      }
      return undefined
    })

    render(PaymentsSettings)

    expect(
      await screen.findByText('Payment provider temporarily unreachable', {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'The payment provider is currently unreachable. Information on this page may be stale or unavailable. Try refreshing in a few moments.',
      ),
    ).toBeInTheDocument()
    // Does NOT show generic "Could not load payment providers" error
    expect(
      screen.queryByText('Could not load payment providers. Try again in a moment.'),
    ).not.toBeInTheDocument()
  })

  it('shows degraded mode notice when listTenantPayouts returns payments/provider-unavailable', async () => {
    setupStandardFetch((url) => {
      if (url.includes('/tenant/payments/payouts')) {
        return problemResponse(
          {
            type: 'payments/provider-unavailable',
            title: 'Stripe unavailable',
            status: 502,
          },
          502,
        )
      }
      return undefined
    })

    render(PaymentsSettings)

    expect(
      await screen.findByText('Payment provider temporarily unreachable', {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'The payment provider is currently unreachable. Information on this page may be stale or unavailable. Try refreshing in a few moments.',
      ),
    ).toBeInTheDocument()
  })

  it('shows degraded mode notice when listPaymentProviders returns payments/provider-unavailable', async () => {
    setupStandardFetch((url) => {
      if (url.includes('/tenant/payments/providers')) {
        return problemResponse(
          {
            type: 'payments/provider-unavailable',
            title: 'Stripe unavailable',
            status: 502,
          },
          502,
        )
      }
      return undefined
    })

    render(PaymentsSettings)

    expect(
      await screen.findByText('Payment provider temporarily unreachable', {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Could not load payment providers. Try again in a moment.'),
    ).not.toBeInTheDocument()
  })

  it('shows generic error and does not show degraded mode notice on generic 500 error', async () => {
    setupStandardFetch((url) => {
      if (url.includes('/tenant/payments/providers')) {
        return problemResponse(
          {
            type: 'about:blank',
            title: 'Server Error',
            status: 500,
          },
          500,
        )
      }
      return undefined
    })

    render(PaymentsSettings)

    expect(
      await screen.findByText(
        'Could not load payment providers. Try again in a moment.',
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Payment provider temporarily unreachable')).not.toBeInTheDocument()
  })

  it('has no accessibility violations in confirmation dialog and blocked state', async () => {
    setupStandardFetch((url, init) => {
      if (
        url.includes('/tenant/payments/connections/conn_active_123') &&
        init?.method === 'DELETE'
      ) {
        return problemResponse(
          {
            type: 'payments/disconnect-blocked',
            title: 'Disconnect blocked',
            status: 409,
            blockers: [
              {
                code: 'in_flight_payments',
                summary_key: 'payments.blocker.in_flight_payments',
              },
            ],
          },
          409,
        )
      }
      return undefined
    })

    const { container } = render(PaymentsSettings)

    const disconnectBtn = await screen.findByRole('button', { name: 'Disconnect provider' })
    await fireEvent.click(disconnectBtn)

    expect(
      await screen.findByRole('heading', { name: 'Disconnect payment provider' }),
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()

    // Trigger blocked state
    const input = screen.getByPlaceholderText('Type DISCONNECT to confirm')
    await fireEvent.input(input, { target: { value: 'DISCONNECT' } })

    const confirmButtons = screen.getAllByRole('button', { name: 'Disconnect provider' })
    await fireEvent.click(confirmButtons[confirmButtons.length - 1])

    expect(await screen.findByText('Cannot disconnect payment provider')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})
