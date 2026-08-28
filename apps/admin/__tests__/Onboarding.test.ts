import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Onboarding from '../src/routes/Onboarding.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

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
      {
        price_id: 'pr2',
        currency: 'USD',
        interval: 'year',
        unit_amount_minor: 29000,
        trial_days: 14,
      },
    ],
    entitlements: [],
  },
]

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (input instanceof Request) return input.url
  return String(input)
}

function mockFetch(input: RequestInfo | URL): Promise<Response> {
  const url = getUrl(input)
  if (url.includes('/public/plans')) {
    return Promise.resolve(jsonResponse(MOCK_PLANS))
  }
  if (url.includes('/public/slug-availability')) {
    return Promise.resolve(jsonResponse({ available: true }))
  }
  if (url.includes('/tenant/billing/checkout-session')) {
    return Promise.resolve(jsonResponse({ url: 'https://checkout.stripe.com/c/pay/cs_test_123' }))
  }
  return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
}

beforeEach(() => {
  // biome-ignore lint/suspicious/noDocumentCookie: test setup reset
  document.cookie = 'sanvi_tenant=; path=/; max-age=0'
  setMemberships([])
  vi.stubGlobal('fetch', vi.fn(mockFetch))
})

afterEach(() => {
  // biome-ignore lint/suspicious/noDocumentCookie: test cleanup reset
  document.cookie = 'sanvi_tenant=; path=/; max-age=0'
  setMemberships([])
  vi.unstubAllGlobals()
})

describe('Admin Onboarding Route Component', () => {
  it('renders Step 1 with organization inputs and auto-derives slug', async () => {
    render(Onboarding)

    expect(screen.getByText('Set up your workspace')).toBeInTheDocument()
    expect(screen.getByText('1. Organization details')).toBeInTheDocument()

    const nameInput = screen.getByPlaceholderText('Acme Academy')
    const slugInput = screen.getByPlaceholderText('acme')

    await fireEvent.input(nameInput, { target: { value: 'My Test Org' } })
    expect(slugInput).toHaveValue('my-test-org')
  })

  it('progresses to Step 2 and displays plan selection with trial terms', async () => {
    render(Onboarding)

    const nameInput = screen.getByPlaceholderText('Acme Academy')
    await fireEvent.input(nameInput, { target: { value: 'Alpha Institute' } })

    expect(await screen.findByText(/Slug is available/i)).toBeInTheDocument()

    const continueBtn = screen.getByRole('button', { name: 'Continue to plan selection' })
    expect(continueBtn).not.toBeDisabled()
    await fireEvent.click(continueBtn)

    expect(await screen.findByText('2. Confirm plan & free trial')).toBeInTheDocument()
    expect(screen.getByText('Trial Terms & Conditions:')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Start 14-day free trial with Stripe' }),
    ).toBeInTheDocument()
  })

  it('resumes at Step 2 when active membership already exists', async () => {
    setMemberships([
      {
        tenantId: 't-existing',
        slug: 'existing-org',
        displayName: 'Existing Org',
        role: 'owner',
      },
    ])
    switchTenant('t-existing')

    render(Onboarding)

    expect(await screen.findByText('2. Confirm plan & free trial')).toBeInTheDocument()
    expect(
      screen.getByText('Finish setting up billing for "Existing Org" to activate your workspace.'),
    ).toBeInTheDocument()
  })

  it('keeps auto-generating slug past 3 characters until manually edited (Defect 8)', async () => {
    render(Onboarding)

    const nameInput = screen.getByPlaceholderText('Acme Academy')
    const slugInput = screen.getByPlaceholderText('acme')

    await fireEvent.input(nameInput, { target: { value: 'Acme' } })
    expect(slugInput).toHaveValue('acme')

    await fireEvent.input(nameInput, { target: { value: 'Acme Academy' } })
    expect(slugInput).toHaveValue('acme-academy')

    // Manual edit breaks derivation
    await fireEvent.input(slugInput, { target: { value: 'custom-slug' } })
    await fireEvent.input(nameInput, { target: { value: 'Acme Academy Global' } })
    expect(slugInput).toHaveValue('custom-slug')
  })

  it('fails slug check to idle and keeps continue button disabled on error (Defect 7)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = getUrl(input)
        if (url.includes('/public/slug-availability')) {
          return Promise.resolve(jsonResponse({ title: 'Server Error' }, 500))
        }
        return mockFetch(input)
      }),
    )

    render(Onboarding)
    const nameInput = screen.getByPlaceholderText('Acme Academy')
    await fireEvent.input(nameInput, { target: { value: 'Broken Org' } })

    const continueBtn = screen.getByRole('button', { name: 'Continue to plan selection' })
    expect(continueBtn).toBeDisabled()
  })

  it('surfaces 403 on provisioning as actionable error instead of generic error (Defect 2)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = getUrl(input)
        if (url.includes('/platform/tenants')) {
          return Promise.resolve(
            jsonResponse({ title: 'Forbidden', detail: 'Platform operator scope required' }, 403),
          )
        }
        return mockFetch(input)
      }),
    )

    render(Onboarding)
    const nameInput = screen.getByPlaceholderText('Acme Academy')
    await fireEvent.input(nameInput, { target: { value: 'Acme Corp' } })

    expect(await screen.findByText(/Slug is available/i, {}, { timeout: 3000 })).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to plan selection' }))

    expect(await screen.findByText('2. Confirm plan & free trial')).toBeInTheDocument()
    const startBtn = await screen.findByRole('button', {
      name: 'Start 14-day free trial with Stripe',
    })
    await fireEvent.click(startBtn)

    expect(
      await screen.findByText(
        'Self-serve organization creation is not available. Please contact support to provision your workspace.',
      ),
    ).toBeInTheDocument()
  })

  it('captures provisioned tenant and activates it before calling checkout session (Defect 3)', async () => {
    let checkoutHeaders: HeadersInit | undefined
    let provisionedTenantId: string | undefined

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = getUrl(input)
        if (url.includes('/platform/tenants')) {
          provisionedTenantId = 'tenant-new-123'
          return Promise.resolve(
            jsonResponse(
              {
                id: 'tenant-new-123',
                tenant_id: 'tenant-new-123',
                slug: 'fresh-tenant',
                display_name: 'Fresh Tenant',
                region: 'us',
                default_locale: 'en',
                status: 'provisioning',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              201,
            ),
          )
        }
        if (url.includes('/tenant/billing/checkout-session')) {
          checkoutHeaders =
            init?.headers ??
            (input instanceof Request ? Object.fromEntries(input.headers.entries()) : undefined)
          return Promise.resolve(jsonResponse({ url: 'https://checkout.stripe.com/test' }))
        }
        return mockFetch(input)
      }),
    )

    render(Onboarding)
    const nameInput = screen.getByPlaceholderText('Acme Academy')
    await fireEvent.input(nameInput, { target: { value: 'Fresh Tenant' } })

    expect(await screen.findByText(/Slug is available/i, {}, { timeout: 3000 })).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to plan selection' }))

    expect(await screen.findByText('2. Confirm plan & free trial')).toBeInTheDocument()
    const startBtn = await screen.findByRole('button', {
      name: 'Start 14-day free trial with Stripe',
    })
    await fireEvent.click(startBtn)

    await vi.waitFor(() => {
      expect(provisionedTenantId).toBe('tenant-new-123')
      expect(checkoutHeaders).toBeDefined()
      expect((checkoutHeaders as Record<string, string>)['x-tenant-id']).toBe('tenant-new-123')
    })
  })

  it('surfaces error when checkout session returns missing url (Defect 11)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = getUrl(input)
        if (url.includes('/tenant/billing/checkout-session')) {
          return Promise.resolve(jsonResponse({ url: null }))
        }
        return mockFetch(input)
      }),
    )

    setMemberships([{ tenantId: 't-test', slug: 'test', displayName: 'Test', role: 'owner' }])
    switchTenant('t-test')

    render(Onboarding)
    expect(await screen.findByText('2. Confirm plan & free trial')).toBeInTheDocument()

    const startBtn = await screen.findByRole('button', {
      name: 'Start 14-day free trial with Stripe',
    })
    await fireEvent.click(startBtn)

    expect(
      await screen.findByText('Something went wrong. Please check your inputs and try again.'),
    ).toBeInTheDocument()
    expect(startBtn).not.toBeDisabled()
  })

  it('has no accessibility violations in Step 1', async () => {
    const { container } = render(Onboarding)
    expect(await axe(container)).toHaveNoViolations()
  })
})
