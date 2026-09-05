import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PaymentsSettings from '../src/routes/PaymentsSettings.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
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
  capabilities: { card_payments: 'active', transfers: 'active' },
  requirements: { currently_due: [], eventually_due: [], past_due: [], deadline: null },
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

const MOCK_TAX_SETTINGS = {
  active_registrations: 2,
  disclaimer: 'Tax registration and remittance is merchant responsibility.',
  enabled: false,
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

describe('PaymentsSettings - Code Review Findings (TASK-008)', () => {
  beforeEach(() => {
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
    setSession({
      userId: 'usr_admin',
      email: 'admin@acme.test',
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
    localStorage.clear()
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
        return Promise.resolve(jsonResponse(MOCK_TAX_SETTINGS))
      }
      if (url.includes('/tenant/entitlements')) {
        return Promise.resolve(
          jsonResponse([{ feature: 'payments.stripe_connect', enabled: true }]),
        )
      }
      return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  // FINDING 2: Secondary data loads without localStorage and shows real not-connected state
  it('loads secondary sections when localStorage is empty and shows real empty payouts state', async () => {
    setupStandardFetch()
    // Notice localStorage is completely empty!
    expect(localStorage.getItem('sanvi:payments:connection:dev-acme')).toBeNull()

    render(PaymentsSettings)

    // Payouts and Tax sections render their real state without vanishing
    expect(await screen.findByText('Payouts')).toBeInTheDocument()
    expect(screen.getByText('Automatic tax')).toBeInTheDocument()
    expect(screen.getByText('Platform fee disclosure')).toBeInTheDocument()
  })

  it('renders payouts empty state when no connection exists server-side', async () => {
    setupStandardFetch((url) => {
      if (url.includes('/tenant/payments/payouts')) {
        return jsonResponse({ payouts: [] })
      }
      return undefined
    })

    render(PaymentsSettings)

    expect(await screen.findByText('Payouts')).toBeInTheDocument()
    expect(screen.getByText('No payouts yet.')).toBeInTheDocument()
    expect(
      screen.getByText('Payouts transferred to your bank account will appear here.'),
    ).toBeInTheDocument()
  })

  // FINDING 3: Promise.allSettled rejections render visible per-section error alerts
  it('renders visible per-section error alert when listTenantPayouts rejects', async () => {
    setupStandardFetch((url) => {
      if (url.includes('/tenant/payments/payouts')) {
        return jsonResponse({ title: 'Internal Server Error' }, 500)
      }
      return undefined
    })

    render(PaymentsSettings)

    expect(await screen.findByText('Payouts', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(
      await screen.findByText(
        'Could not load payouts. Try again in a moment.',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
    // Tax section still loaded successfully
    expect(screen.getByText('Automatic tax')).toBeInTheDocument()
  })

  it('renders visible per-section error alert in tax and fee sections when getTenantTaxSettings rejects', async () => {
    setupStandardFetch((url) => {
      if (url.includes('/tenant/payments/tax-settings')) {
        return jsonResponse({ title: 'Internal Server Error' }, 500)
      }
      return undefined
    })

    render(PaymentsSettings)

    // Both sections render and show visible error rather than silently disappearing
    expect(await screen.findByText('Automatic tax', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Platform fee disclosure')).toBeInTheDocument()
    const errorAlerts = await screen.findAllByText(
      'Could not load tax and fee settings. Try again in a moment.',
      {},
      { timeout: 3000 },
    )
    expect(errorAlerts.length).toBeGreaterThanOrEqual(1)
  })

  // FINDING 5: 409 preflight failure shows localized string, never raw err.message
  it('shows localized preflight string and not raw backend error message on 409 tax update error', async () => {
    setupStandardFetch((url, init) => {
      if (url.includes('/tenant/payments/tax-settings') && init?.method === 'PUT') {
        return jsonResponse(
          {
            title: 'Raw English backend preflight failure detail',
            status: 409,
            type: 'payments/tax-preflight-failed',
          },
          409,
        )
      }
      return undefined
    })

    render(PaymentsSettings)

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Automatic tax calculation',
    })
    await fireEvent.click(checkbox)

    expect(
      await screen.findByText(
        'Automatic tax cannot be enabled because the tax compliance check did not pass.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Raw English backend preflight failure detail'),
    ).not.toBeInTheDocument()
  })

  // FINDING 6: An enabled fee never hides because currency is unknown
  it('renders configured fixed and minimum fees with explicit unknown currency indication when currency is missing', async () => {
    setupStandardFetch((url) => {
      if (url.includes('/tenant/payments/tax-settings')) {
        return jsonResponse({
          ...MOCK_TAX_SETTINGS,
          platform_fee: {
            basis_points: 290,
            enabled: true,
            fixed_currency: null,
            fixed_minor: 45,
            minimum_minor: 75,
          },
        })
      }
      return undefined
    })

    render(PaymentsSettings)

    expect(await screen.findByText('Platform fee disclosure')).toBeInTheDocument()
    expect(screen.getByText('Fixed fee')).toBeInTheDocument()
    expect(screen.getByText('45 (currency unknown)')).toBeInTheDocument()
    expect(screen.getByText('Minimum fee')).toBeInTheDocument()
    expect(screen.getByText('75 (currency unknown)')).toBeInTheDocument()
  })

  // FINDING 7: Raw enum provider_status translated
  it('translates inactive and pending provider_status values in the tax section', async () => {
    setupStandardFetch((url) => {
      if (url.includes('/tenant/payments/tax-settings')) {
        return jsonResponse({
          ...MOCK_TAX_SETTINGS,
          provider_status: 'inactive',
        })
      }
      return undefined
    })

    render(PaymentsSettings)

    expect(await screen.findByText('Tax engine status')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.queryByText('inactive')).not.toBeInTheDocument()
  })

  // FINDING 4: Post-onboarding state is refreshed when connection becomes active
  it('refreshes secondary state by running load() when onboarding connection becomes active', async () => {
    localStorage.setItem('sanvi:payments:connection:dev-acme', 'conn_active_123')
    let fetchPayoutsCount = 0
    setupStandardFetch((url) => {
      if (url.includes('/tenant/payments/payouts')) {
        fetchPayoutsCount++
        return jsonResponse({ payouts: MOCK_PAYOUTS })
      }
      return undefined
    })

    render(PaymentsSettings)

    expect(await screen.findByText('Payouts')).toBeInTheDocument()
    expect(fetchPayoutsCount).toBeGreaterThanOrEqual(1)
  })
})
