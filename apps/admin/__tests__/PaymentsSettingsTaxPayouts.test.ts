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
  {
    amount_minor: 12500,
    arrival_at: '2026-08-28T10:00:00Z',
    currency: 'USD',
    external_payout_id: 'po_stripe_2',
    status: 'pending',
  },
]

const MOCK_FAILED_PAYOUTS = [
  ...MOCK_PAYOUTS,
  {
    amount_minor: 7500,
    arrival_at: '2026-08-29T10:00:00Z',
    currency: 'USD',
    external_payout_id: 'po_stripe_3',
    status: 'failed',
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

const HEALTHY_TAX_SETTINGS_JPY = {
  ...HEALTHY_TAX_SETTINGS,
  platform_fee: {
    basis_points: 360,
    enabled: true,
    fixed_currency: 'JPY',
    fixed_minor: 40,
    minimum_minor: 50,
  },
}

describe('PaymentsSettings - Payouts, Tax, and Fee Disclosure (TASK-007)', () => {
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

  it('renders payouts table with formatted amounts, dates, badges and IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
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
      }),
    )

    render(PaymentsSettings)

    expect(await screen.findByText('Payouts')).toBeInTheDocument()
    expect(screen.getByText('$500.00')).toBeInTheDocument()
    expect(screen.getByText('$125.00')).toBeInTheDocument()
    expect(screen.getByText('po_stripe_1')).toBeInTheDocument()
    expect(screen.getByText('po_stripe_2')).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()

    // No failed payout alert when no payouts are failed
    expect(screen.queryByText('Failed payout')).not.toBeInTheDocument()
  })

  it('renders non-dismissible failed-payout notice when any payout in list has status failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
        }
        if (url.includes('/tenant/payments/connections/conn_active_123')) {
          return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
        }
        if (url.includes('/tenant/payments/payouts')) {
          return Promise.resolve(jsonResponse({ payouts: MOCK_FAILED_PAYOUTS }))
        }
        if (url.includes('/tenant/payments/tax-settings')) {
          return Promise.resolve(jsonResponse(HEALTHY_TAX_SETTINGS))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentsSettings)

    expect(await screen.findByText('Failed payout')).toBeInTheDocument()
    expect(
      screen.getByText(
        'A payout to your bank account failed. Your funds are held securely until payout details are resolved in Stripe account management.',
      ),
    ).toBeInTheDocument()

    // Ensure it is NOT dismissible (no close / dismiss button inside the failed payout alert)
    const alert = screen.getByText('Failed payout').closest('.sanvi-alert')
    expect(alert?.querySelector('button[aria-label="Dismiss"]')).toBeNull()
    expect(alert?.querySelector('button[aria-label="Close"]')).toBeNull()
  })

  it('renders empty payouts state when no payouts exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
        }
        if (url.includes('/tenant/payments/connections/conn_active_123')) {
          return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
        }
        if (url.includes('/tenant/payments/payouts')) {
          return Promise.resolve(jsonResponse({ payouts: [] }))
        }
        if (url.includes('/tenant/payments/tax-settings')) {
          return Promise.resolve(jsonResponse(HEALTHY_TAX_SETTINGS))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentsSettings)

    expect(await screen.findByText('No payouts yet.')).toBeInTheDocument()
    expect(
      screen.getByText('Payouts transferred to your bank account will appear here.'),
    ).toBeInTheDocument()
  })

  it('renders tax section preflight info, disclaimer, and enabled toggle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
        }
        if (url.includes('/tenant/payments/connections/conn_active_123')) {
          return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
        }
        if (url.includes('/tenant/payments/payouts')) {
          return Promise.resolve(jsonResponse({ payouts: [] }))
        }
        if (url.includes('/tenant/payments/tax-settings')) {
          return Promise.resolve(jsonResponse(HEALTHY_TAX_SETTINGS))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentsSettings)

    expect(await screen.findByText('Automatic tax')).toBeInTheDocument()
    expect(
      screen.getByText(
        "Registration, collection, and remittance of tax are the merchant's sole responsibility. Sanvi provides no tax, accounting, or legal advice. Consult a qualified professional regarding your tax obligations.",
      ),
    ).toBeInTheDocument()

    // Preflight indicators
    expect(screen.getByText('Active registrations')).toBeInTheDocument()
    expect(screen.getByText('2 active registrations')).toBeInTheDocument()
    expect(screen.getByText('Tax engine status')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('acct_stripe_123')).toBeInTheDocument()

    // Toggle is checked and enabled
    const toggle = screen.getByRole('checkbox', { name: 'Automatic tax calculation' })
    expect(toggle).toBeChecked()
    expect(toggle).not.toBeDisabled()
  })

  it('disables tax toggle with translated warning when TaxWarningView is present', async () => {
    const warningTaxSettings = {
      ...HEALTHY_TAX_SETTINGS,
      enabled: false,
      warning: {
        code: 'payments.tax.warning.no_registrations',
        detected_at: '2026-08-28T14:30:00Z',
        detail: 'Backend english detail for audit logs only',
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
        }
        if (url.includes('/tenant/payments/connections/conn_active_123')) {
          return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
        }
        if (url.includes('/tenant/payments/payouts')) {
          return Promise.resolve(jsonResponse({ payouts: [] }))
        }
        if (url.includes('/tenant/payments/tax-settings')) {
          return Promise.resolve(jsonResponse(warningTaxSettings))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentsSettings)

    expect(await screen.findByText('Automatic tax')).toBeInTheDocument()
    expect(screen.getByText('Tax configuration warning')).toBeInTheDocument()
    // Code is translated through i18n, detail is NOT rendered directly
    const warnings = screen.getAllByText(
      'No active tax registrations found. Add registrations in your Stripe Tax settings before enabling.',
    )
    expect(warnings.length).toBeGreaterThan(0)
    expect(screen.queryByText('Backend english detail for audit logs only')).not.toBeInTheDocument()

    // Toggle is disabled and shows reason
    const toggle = screen.getByRole('checkbox', { name: 'Automatic tax calculation' })
    expect(toggle).toBeDisabled()
    expect(toggle).not.toBeChecked()
  })

  it('disables tax toggle when provider_status is inactive', async () => {
    const inactiveTaxSettings = {
      ...HEALTHY_TAX_SETTINGS,
      enabled: false,
      provider_status: 'pending',
      active_registrations: 2,
    }

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
        }
        if (url.includes('/tenant/payments/connections/conn_active_123')) {
          return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
        }
        if (url.includes('/tenant/payments/payouts')) {
          return Promise.resolve(jsonResponse({ payouts: [] }))
        }
        if (url.includes('/tenant/payments/tax-settings')) {
          return Promise.resolve(jsonResponse(inactiveTaxSettings))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentsSettings)

    expect(await screen.findByText('Automatic tax')).toBeInTheDocument()
    const toggle = screen.getByRole('checkbox', { name: 'Automatic tax calculation' })
    expect(toggle).toBeDisabled()
    expect(
      screen.getByText(
        'Tax settings status must be active in Stripe before enabling automatic tax.',
      ),
    ).toBeInTheDocument()
  })

  it('disables tax toggle when user lacks payments.manage permission', async () => {
    setSession({
      userId: 'usr_1',
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

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
        }
        if (url.includes('/tenant/payments/connections/conn_active_123')) {
          return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
        }
        if (url.includes('/tenant/payments/payouts')) {
          return Promise.resolve(jsonResponse({ payouts: [] }))
        }
        if (url.includes('/tenant/payments/tax-settings')) {
          return Promise.resolve(jsonResponse(HEALTHY_TAX_SETTINGS))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentsSettings)

    expect(await screen.findByText('Automatic tax')).toBeInTheDocument()
    const toggle = screen.getByRole('checkbox', { name: 'Automatic tax calculation' })
    expect(toggle).toBeDisabled()
    expect(
      screen.getByText('You do not have permission to manage tax settings.'),
    ).toBeInTheDocument()
  })

  it('opens confirmation dialog on toggle off, warning of mid-period customer charging consequences, and updates on confirm', async () => {
    let currentSettings = { ...HEALTHY_TAX_SETTINGS, enabled: true }
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/tenant/payments/providers')) {
        return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
      }
      if (url.includes('/tenant/payments/connections/conn_active_123')) {
        return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
      }
      if (url.includes('/tenant/payments/payouts')) {
        return Promise.resolve(jsonResponse({ payouts: [] }))
      }
      if (url.includes('/tenant/payments/tax-settings') && init?.method === 'PUT') {
        currentSettings = { ...currentSettings, enabled: false }
        return Promise.resolve(jsonResponse(currentSettings))
      }
      if (url.includes('/tenant/payments/tax-settings')) {
        return Promise.resolve(jsonResponse(currentSettings))
      }
      return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(PaymentsSettings)

    expect(await screen.findByText('Automatic tax')).toBeInTheDocument()
    const toggle = screen.getByRole('checkbox', { name: 'Automatic tax calculation' })
    expect(toggle).toBeChecked()

    // Click toggle to disable
    await fireEvent.click(toggle)

    // Confirmation dialog appears with mid-period consequence copy
    expect(screen.getByRole('heading', { name: 'Disable automatic tax' })).toBeInTheDocument()
    expect(
      screen.getByText(
        /Disabling automatic tax will stop tax calculation and collection on upcoming customer checkouts/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/affects what customers are charged mid-period/)).toBeInTheDocument()

    // Confirm disable
    const confirmBtn = screen.getByRole('button', { name: 'Disable automatic tax' })
    await fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/tenant/payments/tax-settings'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ enabled: false }),
        }),
      )
    })
  })

  it('enables automatic tax on toggle on when preflight passes', async () => {
    let currentSettings = { ...HEALTHY_TAX_SETTINGS, enabled: false }
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/tenant/payments/providers')) {
        return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
      }
      if (url.includes('/tenant/payments/connections/conn_active_123')) {
        return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
      }
      if (url.includes('/tenant/payments/payouts')) {
        return Promise.resolve(jsonResponse({ payouts: [] }))
      }
      if (url.includes('/tenant/payments/tax-settings') && init?.method === 'PUT') {
        currentSettings = { ...currentSettings, enabled: true }
        return Promise.resolve(jsonResponse(currentSettings))
      }
      if (url.includes('/tenant/payments/tax-settings')) {
        return Promise.resolve(jsonResponse(currentSettings))
      }
      return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(PaymentsSettings)

    expect(await screen.findByText('Automatic tax')).toBeInTheDocument()
    const toggle = screen.getByRole('checkbox', { name: 'Automatic tax calculation' })
    expect(toggle).not.toBeChecked()

    // Click toggle to enable
    await fireEvent.click(toggle)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/tenant/payments/tax-settings'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ enabled: true }),
        }),
      )
    })
  })

  it('renders platform fee disclosure with formatted USD values when platform_fee is enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
        }
        if (url.includes('/tenant/payments/connections/conn_active_123')) {
          return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
        }
        if (url.includes('/tenant/payments/payouts')) {
          return Promise.resolve(jsonResponse({ payouts: [] }))
        }
        if (url.includes('/tenant/payments/tax-settings')) {
          return Promise.resolve(jsonResponse(HEALTHY_TAX_SETTINGS))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentsSettings)

    expect(await screen.findByText('Platform fee disclosure')).toBeInTheDocument()
    expect(screen.getByText('2.90%')).toBeInTheDocument()
    expect(screen.getByText('$0.30')).toBeInTheDocument()
    expect(screen.getByText('$0.50')).toBeInTheDocument()
  })

  it('renders platform fee disclosure with JPY-correct zero decimal formatting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
        }
        if (url.includes('/tenant/payments/connections/conn_active_123')) {
          return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
        }
        if (url.includes('/tenant/payments/payouts')) {
          return Promise.resolve(jsonResponse({ payouts: [] }))
        }
        if (url.includes('/tenant/payments/tax-settings')) {
          return Promise.resolve(jsonResponse(HEALTHY_TAX_SETTINGS_JPY))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentsSettings)

    expect(await screen.findByText('Platform fee disclosure')).toBeInTheDocument()
    expect(screen.getByText('3.60%')).toBeInTheDocument()
    expect(screen.getByText('¥40')).toBeInTheDocument()
    expect(screen.getByText('¥50')).toBeInTheDocument()
  })

  it('renders NOTHING when platform_fee is null or disabled', async () => {
    const noFeeSettings = {
      ...HEALTHY_TAX_SETTINGS,
      platform_fee: null,
    }

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
        }
        if (url.includes('/tenant/payments/connections/conn_active_123')) {
          return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
        }
        if (url.includes('/tenant/payments/payouts')) {
          return Promise.resolve(jsonResponse({ payouts: [] }))
        }
        if (url.includes('/tenant/payments/tax-settings')) {
          return Promise.resolve(jsonResponse(noFeeSettings))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentsSettings)

    await screen.findByText('Automatic tax')
    expect(screen.queryByText('Platform fee disclosure')).not.toBeInTheDocument()
  })

  it('has no accessibility violations across all new sections', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
        }
        if (url.includes('/tenant/payments/connections/conn_active_123')) {
          return Promise.resolve(jsonResponse(ACTIVE_CONNECTION))
        }
        if (url.includes('/tenant/payments/payouts')) {
          return Promise.resolve(jsonResponse({ payouts: MOCK_FAILED_PAYOUTS }))
        }
        if (url.includes('/tenant/payments/tax-settings')) {
          return Promise.resolve(jsonResponse(HEALTHY_TAX_SETTINGS))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    const { container } = render(PaymentsSettings)
    await screen.findByText('Automatic tax')
    expect(await axe(container)).toHaveNoViolations()
  })
})
