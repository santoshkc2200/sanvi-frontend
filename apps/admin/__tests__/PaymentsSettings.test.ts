import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
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

const FAKE_PROVIDER = {
  kind: 'fake',
  display_name: 'Test provider',
  available: true,
  requires_onboarding: true,
  supported_countries: ['US', 'JP'],
}

const UNAVAILABLE_PROVIDER = {
  kind: 'stripe_connect',
  display_name: 'Stripe',
  available: false,
  requires_onboarding: true,
  supported_countries: ['US', 'JP'],
}

function mockFetchForProviders(providers: unknown[]) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/tenant/payments/providers')) {
      return Promise.resolve(jsonResponse({ providers }))
    }
    if (url.includes('/tenant/entitlements')) {
      return Promise.resolve(jsonResponse([{ feature: 'payments.stripe_connect', enabled: true }]))
    }
    return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
  })
}

function mockUnentitledFetch(providers: unknown[]) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/tenant/payments/providers')) {
      return Promise.resolve(jsonResponse({ providers }))
    }
    if (url.includes('/tenant/entitlements')) {
      return Promise.resolve(jsonResponse([]))
    }
    return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
  })
}

beforeEach(() => {
  setMemberships([
    { tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' },
    { tenantId: 'dev-unentitled', slug: 'unentitled', displayName: 'Unentitled', role: 'owner' },
    { tenantId: 'dev-empty', slug: 'empty', displayName: 'Empty', role: 'owner' },
    { tenantId: 'dev-error', slug: 'error', displayName: 'Error Corp', role: 'owner' },
  ])
  switchTenant('dev-acme')
  setEntitlements([{ feature: 'payments.stripe_connect', enabled: true }])
  vi.stubGlobal('fetch', mockFetchForProviders([STRIPE_PROVIDER, FAKE_PROVIDER]))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Admin PaymentsSettings Route Component', () => {
  it('renders provider cards from API response with no kind-specific branching', async () => {
    render(PaymentsSettings)

    expect(await screen.findByText('Payment providers')).toBeInTheDocument()
    expect(screen.getByText('Stripe')).toBeInTheDocument()
    expect(screen.getByText('Test provider')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Connect' })).toHaveLength(2)
    expect(screen.getByText('What happens when you connect')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Stripe collects your business details to verify your account. Payouts go directly to your own bank account — Sanvi never holds your money.',
      ),
    ).toBeInTheDocument()
  })

  it('renders synthetic provider kind without production code change', async () => {
    const synthetic = {
      kind: 'synthetic_unknown',
      display_name: 'Synthetic Unknown',
      available: true,
      requires_onboarding: true,
      supported_countries: ['US'],
    }
    vi.stubGlobal('fetch', mockFetchForProviders([STRIPE_PROVIDER, synthetic]))

    render(PaymentsSettings)

    expect(await screen.findByText('Synthetic Unknown')).toBeInTheDocument()
    expect(screen.getByText('Stripe')).toBeInTheDocument()
  })

  it('renders unavailable state for provider not supported in tenant country, not a dead connect button', async () => {
    vi.stubGlobal('fetch', mockFetchForProviders([UNAVAILABLE_PROVIDER]))

    render(PaymentsSettings)

    expect(await screen.findByText('Unavailable in your region')).toBeInTheDocument()
    expect(screen.getByText('This provider is not available in your country.')).toBeInTheDocument()
    expect(screen.getByText(/Supported countries: US, JP/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
  })

  it('keeps card list visible when not entitled and replaces CTA with UpgradePrompt', async () => {
    switchTenant('dev-unentitled')
    setEntitlements([])
    vi.stubGlobal('fetch', mockUnentitledFetch([STRIPE_PROVIDER]))

    render(PaymentsSettings)

    expect(await screen.findByText('Stripe')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
    expect(screen.getByText('Upgrade required')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Accepting payments needs a plan with Stripe Connect. Ask a tenant owner to upgrade.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View plans & upgrade' })).toHaveAttribute(
      'href',
      '/billing',
    )
  })

  it('renders upgrade prompt and no error alert when catalog returns 403', async () => {
    switchTenant('dev-unentitled')
    setEntitlements([])
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ message: 'Forbidden' }, 403))
        }
        if (url.includes('/tenant/entitlements')) {
          return Promise.resolve(jsonResponse([]))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentsSettings)

    expect(await screen.findByText('Upgrade required')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Accepting payments needs a plan with Stripe Connect. Ask a tenant owner to upgrade.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Could not load payment providers. Try again in a moment.'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Stripe')).not.toBeInTheDocument()
  })

  it('renders upgrade prompt and no error alert when catalog returns 404 even with client entitlement active', async () => {
    switchTenant('dev-acme')
    setEntitlements([{ feature: 'payments.stripe_connect', enabled: true }])
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ message: 'Not found' }, 404))
        }
        if (url.includes('/tenant/entitlements')) {
          return Promise.resolve(
            jsonResponse([{ feature: 'payments.stripe_connect', enabled: true }]),
          )
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentsSettings)

    expect(await screen.findByText('Upgrade required')).toBeInTheDocument()
    expect(
      screen.queryByText('Could not load payment providers. Try again in a moment.'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Stripe')).not.toBeInTheDocument()
  })

  it('renders error alert when loading fails with 500', async () => {
    switchTenant('dev-error')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : ((input as Request).url ?? input.toString())
        if (url.includes('/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ title: 'Internal Server Error' }, 500))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentsSettings)

    expect(
      await screen.findByText(
        'Could not load payment providers. Try again in a moment.',
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(PaymentsSettings)
    await screen.findByText('Payment providers')
    expect(await axe(container)).toHaveNoViolations()
  })
})
