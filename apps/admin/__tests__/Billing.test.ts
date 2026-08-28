import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Billing from '../src/routes/Billing.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const MOCK_SUBSCRIPTION = {
  subscription_id: '0190f0d0-0000-7000-8000-000000000001',
  plan_key: 'professional',
  plan_name: 'Professional',
  status: 'active',
  source: 'stripe',
  collection_state: 'ok',
  cancel_at_period_end: false,
  current_period: {
    start: '2026-08-01T00:00:00Z',
    end: '2026-09-01T00:00:00Z',
  },
}

const MOCK_INVOICES = [
  {
    invoice_id: 'in_1234567890',
    number: 'INV-2026-001',
    status: 'paid',
    currency: 'USD',
    total_minor: 7900,
    created_at: '2026-08-01T00:00:00Z',
    hosted_url: 'https://invoice.stripe.com/test1',
    pdf_url: 'https://invoice.stripe.com/test1.pdf',
  },
]

const MOCK_PLANS = [
  {
    plan_id: 'p1',
    key: 'starter',
    name: 'Starter',
    tier: 'starter',
    sort_order: 1,
    prices: [
      {
        price_id: 'pr1',
        currency: 'USD',
        interval: 'month',
        unit_amount_minor: 2900,
        trial_days: 14,
      },
    ],
    entitlements: [],
  },
  {
    plan_id: 'p2',
    key: 'professional',
    name: 'Professional',
    tier: 'professional',
    sort_order: 2,
    prices: [
      {
        price_id: 'pr2',
        currency: 'USD',
        interval: 'month',
        unit_amount_minor: 7900,
        trial_days: 14,
      },
    ],
    entitlements: [],
  },
]

const MOCK_ENTITLEMENTS = [
  {
    feature: 'courses.count',
    kind: 'quota',
    limit: 25,
    source: 'plan:professional',
  },
  {
    feature: 'domains.custom',
    kind: 'boolean',
    enabled: true,
    source: 'plan:professional',
  },
]

function mockFetch(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  if (url.includes('/tenant/billing/subscription')) {
    return Promise.resolve(jsonResponse(MOCK_SUBSCRIPTION))
  }
  if (url.includes('/tenant/billing/invoices')) {
    return Promise.resolve(jsonResponse(MOCK_INVOICES))
  }
  if (url.includes('/public/plans')) {
    return Promise.resolve(jsonResponse(MOCK_PLANS))
  }
  if (url.includes('/tenant/entitlements')) {
    return Promise.resolve(jsonResponse(MOCK_ENTITLEMENTS))
  }
  if (url.includes('/tenant/billing/portal-session')) {
    return Promise.resolve(jsonResponse({ url: 'https://billing.stripe.com/session/test' }))
  }
  return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
}

beforeEach(() => {
  setMemberships([
    { tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' },
    { tenantId: 'dev-error', slug: 'error', displayName: 'Error Corp', role: 'owner' },
  ])
  switchTenant('dev-acme')
  vi.stubGlobal('fetch', vi.fn(mockFetch))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Admin Billing Route Component', () => {
  it('renders overview with active plan details and tabs', async () => {
    render(Billing)

    expect(await screen.findByText('Current Subscription')).toBeInTheDocument()
    expect(screen.getByText('Professional')).toBeInTheDocument()
    expect(screen.getByText('Payment Method')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Usage & Quotas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Change Plan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Invoices' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cancel Subscription' })).toBeInTheDocument()
  })

  it('switches to Usage tab and renders resource limits', async () => {
    render(Billing)
    await screen.findByText('Current Subscription')

    const usageTab = screen.getByRole('link', { name: 'Usage & Quotas' })
    await fireEvent.click(usageTab)

    expect(await screen.findByText('Resource Limits')).toBeInTheDocument()
    expect(screen.getByText('courses.count')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('domains.custom')).toBeInTheDocument()
  })

  it('switches to Invoices tab and renders invoice table with formatted total', async () => {
    render(Billing)
    await screen.findByText('Current Subscription')

    const invoicesTab = screen.getByRole('link', { name: 'Invoices' })
    await fireEvent.click(invoicesTab)

    expect(await screen.findByText('Invoice History')).toBeInTheDocument()
    expect(screen.getByText('INV-2026-001')).toBeInTheDocument()
    expect(screen.getByText('$79.00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      'https://invoice.stripe.com/test1',
    )
    expect(screen.getByRole('link', { name: 'PDF' })).toHaveAttribute(
      'href',
      'https://invoice.stripe.com/test1.pdf',
    )
  })

  it('switches to Cancel tab and displays retention guidance', async () => {
    render(Billing)
    await screen.findByText('Current Subscription')

    const cancelTab = screen.getByRole('link', { name: 'Cancel Subscription' })
    await fireEvent.click(cancelTab)

    expect(await screen.findByText('What happens when you cancel:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to cancel in Stripe' })).toBeInTheDocument()
  })

  it('renders error alert when getSubscription fails with 500 instead of rendering empty state (Defect 5)', async () => {
    switchTenant('dev-error')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : ((input as Request).url ?? input.toString())
        if (url.includes('/tenant/billing/subscription')) {
          return Promise.resolve(jsonResponse({ title: 'Internal Server Error' }, 500))
        }
        return mockFetch(input)
      }),
    )

    render(Billing)
    expect(
      await screen.findByText(
        'Could not load billing details. Please try again in a moment.',
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('No active subscription')).not.toBeInTheDocument()
  })

  it('surfaces error alert when customer portal session returns missing url (Defect 11)', async () => {
    switchTenant('dev-acme')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : ((input as Request).url ?? input.toString())
        if (url.includes('/tenant/billing/portal-session')) {
          return Promise.resolve(jsonResponse({ url: null }))
        }
        return mockFetch(input)
      }),
    )

    render(Billing)
    await screen.findByText('Current Subscription')

    const manageBtn = screen.getByRole('button', { name: 'Manage in Stripe' })
    await fireEvent.click(manageBtn)

    expect(
      await screen.findByText('Could not open the customer portal. Please try again.'),
    ).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(Billing)
    await screen.findByText('Current Subscription')
    expect(await axe(container)).toHaveNoViolations()
  })
})
