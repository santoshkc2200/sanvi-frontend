import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DomainDetail from '../src/routes/DomainDetail.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function makeDomain(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dom_123',
    hostname: 'shop.example.com',
    kind: 'connected',
    role: 'primary',
    status: 'live',
    challenge: {
      challenge_type: 'txt',
      token: 'tok_abc123',
      txt_name: '_sanvi-challenge.shop.example.com',
      txt_value: 'sanvi-verification=tok_abc123',
      expires_at: '2026-09-01T00:00:00Z',
    },
    detected_registrar: 'cloudflare',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    verified_at: '2026-08-01T01:00:00Z',
    ...overrides,
  }
}

describe('Admin DomainDetail Route Component', () => {
  let domainsList: ReturnType<typeof makeDomain>[] = []

  beforeEach(() => {
    setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
    switchTenant('dev-acme')
    domainsList = [makeDomain()]

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/domains')) {
          return Promise.resolve(jsonResponse(domainsList))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders domain details, status timeline, DNS records table, security notice and danger zone', async () => {
    render(DomainDetail, { props: { id: 'dom_123' } })

    expect(
      await screen.findByRole('heading', { name: 'shop.example.com', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Domain lifecycle')).toBeInTheDocument()
    expect(screen.getByText('Claimed')).toBeInTheDocument()
    expect(screen.getByText('Live & Secure')).toBeInTheDocument()

    // First section below header is DNS Configuration
    expect(screen.getByText('DNS Configuration')).toBeInTheDocument()
    expect(screen.getByText('_sanvi-challenge.shop.example.com')).toBeInTheDocument()
    expect(screen.getByText('sanvi-verification=tok_abc123')).toBeInTheDocument()

    // Security notice
    expect(screen.getByText('Security notice')).toBeInTheDocument()
    expect(
      screen.getByText(/Sanvi will never ask for your domain registrar account password/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Detected DNS provider: cloudflare/)).toBeInTheDocument()

    // SSL/TLS Certificate
    expect(screen.getByText('SSL/TLS Certificate')).toBeInTheDocument()
    expect(screen.getByText(/Active \(Let's Encrypt \/ Managed TLS\)/)).toBeInTheDocument()

    // Danger zone
    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
    const makePrimaryBtn = screen.getByRole('button', { name: 'Set as primary domain' })
    const removeBtn = screen.getByRole('button', { name: 'Remove domain' })
    expect(makePrimaryBtn).toBeDisabled()
    expect(makePrimaryBtn).toHaveAttribute('title', 'This is already the primary domain')
    expect(removeBtn).not.toBeDisabled()
  })

  it('renders not found state when domain is missing', async () => {
    render(DomainDetail, { props: { id: 'dom_nonexistent' } })

    expect(await screen.findByText('Domain not found')).toBeInTheDocument()
    expect(
      screen.getByText('The requested domain claim could not be found or has been removed.'),
    ).toBeInTheDocument()
  })

  it.each([
    'pending_setup',
    'verifying',
    'verified',
    'issuing_cert',
    'live',
    'degraded',
    'removed',
  ] as const)('renders correctly for status: %s', async (status) => {
    domainsList = [
      makeDomain({
        id: `dom_${status}`,
        hostname: `shop-${status}.example.com`,
        status,
        failure:
          status === 'degraded'
            ? { code: 'dns_drift', detail: 'DNS changed' }
            : status === 'removed'
              ? { code: 'removed_by_tenant', detail: 'User removed' }
              : undefined,
      }),
    ]

    const { container } = render(DomainDetail, { props: { id: `dom_${status}` } })
    expect(
      await screen.findByRole('heading', { name: `shop-${status}.example.com`, level: 1 }),
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it.each([
    ['cert_invalid', 'TLS certificate issuance failed. The system will automatically retry.'],
    [
      'dns_drift',
      'DNS records changed unexpectedly after verification. Please verify your DNS configuration.',
    ],
    [
      'probe_failed',
      'Health check probe failed. Storefront edge could not be reached via this domain.',
    ],
  ])('renders degraded health explanation for code %s', async (code, expectedText) => {
    domainsList = [
      makeDomain({
        id: 'dom_degraded',
        status: 'degraded',
        failure: { code, detail: 'Failure detail' },
      }),
    ]

    render(DomainDetail, { props: { id: 'dom_degraded' } })

    expect(await screen.findByText(expectedText)).toBeInTheDocument()
    expect(screen.getAllByText('Degraded').length).toBeGreaterThanOrEqual(1)
  })

  it('renders expiry warning banner and manages auto-renew for domain expiring soon', async () => {
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    const mockOrder = {
      id: 'ord_123',
      hostname: 'shop.example.com',
      term_years: 1,
      price_minor: 1500,
      currency: 'USD',
      status: 'active',
      auto_renew: false,
      whois_privacy: true,
      registered_at: '2025-09-01T00:00:00Z',
      expires_at: futureDate,
      created_at: '2025-09-01T00:00:00Z',
    }

    let updatedAutoRenew = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/domains/orders/ord_123/auto-renew')) {
          const body = JSON.parse(init?.body as string)
          updatedAutoRenew = body.enabled
          return Promise.resolve(jsonResponse({ ...mockOrder, auto_renew: body.enabled }))
        }
        if (url.includes('/tenant/domains/orders')) {
          return Promise.resolve(jsonResponse([mockOrder]))
        }
        if (url.includes('/tenant/domains')) {
          return Promise.resolve(jsonResponse(domainsList))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(DomainDetail, { props: { id: 'dom_123' } })

    expect(await screen.findByText('Domain expires soon')).toBeInTheDocument()
    expect(screen.getByText(/15 days remaining/)).toBeInTheDocument()
    expect(screen.getByText(/Auto-renew is disabled/)).toBeInTheDocument()
    expect(screen.getByText('Domain Registration & Renewal')).toBeInTheDocument()

    // Toggle auto-renew
    const enableBtn = screen.getByRole('button', { name: 'Enable auto-renew' })
    enableBtn.click()

    expect(await screen.findByRole('button', { name: 'Disable auto-renew' })).toBeInTheDocument()
    expect(updatedAutoRenew).toBe(true)
  })

  it('does not render expiry warning banner when domain is not expiring soon', async () => {
    const futureDate = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString()
    const mockOrder = {
      id: 'ord_123',
      hostname: 'shop.example.com',
      term_years: 1,
      price_minor: 1500,
      currency: 'USD',
      status: 'active',
      auto_renew: true,
      whois_privacy: true,
      registered_at: '2026-01-01T00:00:00Z',
      expires_at: futureDate,
      created_at: '2026-01-01T00:00:00Z',
    }

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/domains/orders')) {
          return Promise.resolve(jsonResponse([mockOrder]))
        }
        if (url.includes('/tenant/domains')) {
          return Promise.resolve(jsonResponse(domainsList))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(DomainDetail, { props: { id: 'dom_123' } })

    expect(
      await screen.findByRole('heading', { name: 'shop.example.com', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Domain expires soon')).not.toBeInTheDocument()
    expect(screen.getByText('Domain Registration & Renewal')).toBeInTheDocument()
  })

  it('promotes an alias domain to primary domain on confirmation', async () => {
    domainsList = [
      makeDomain({
        id: 'dom_alias',
        hostname: 'blog.example.com',
        role: 'alias',
      }),
    ]

    let promoted = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/domains/dom_alias/promote')) {
          promoted = true
          return Promise.resolve(
            jsonResponse(
              makeDomain({ id: 'dom_alias', hostname: 'blog.example.com', role: 'primary' }),
            ),
          )
        }
        if (url.includes('/tenant/domains')) {
          return Promise.resolve(jsonResponse(domainsList))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(DomainDetail, { props: { id: 'dom_alias' } })

    const makePrimaryBtn = await screen.findByRole('button', { name: 'Set as primary domain' })
    expect(makePrimaryBtn).not.toBeDisabled()

    await fireEvent.click(makePrimaryBtn)

    // Promote confirmation dialog is open
    expect(screen.getByText(/Search engines and visitors will be redirected/)).toBeInTheDocument()
    expect(
      screen.getByText(/Your storefront's main address will become https:\/\/blog\.example\.com/),
    ).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: 'Confirm primary switch' })
    await fireEvent.click(confirmBtn)

    expect(promoted).toBe(true)
    // After promotion, role is updated
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Set as primary domain' })).toBeDisabled()
    })
  })

  it('cancels primary domain switch without calling API', async () => {
    domainsList = [
      makeDomain({
        id: 'dom_alias',
        hostname: 'blog.example.com',
        role: 'alias',
      }),
    ]

    let promoteCalled = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/domains/dom_alias/promote')) {
          promoteCalled = true
          return Promise.resolve(jsonResponse({}))
        }
        if (url.includes('/tenant/domains')) {
          return Promise.resolve(jsonResponse(domainsList))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(DomainDetail, { props: { id: 'dom_alias' } })

    const makePrimaryBtn = await screen.findByRole('button', { name: 'Set as primary domain' })
    await fireEvent.click(makePrimaryBtn)

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    await fireEvent.click(cancelBtn)

    expect(promoteCalled).toBe(false)
    expect(
      screen.queryByText(/Search engines and visitors will be redirected/),
    ).not.toBeInTheDocument()
  })

  it('requires exact typed hostname to confirm domain removal', async () => {
    let removeCalled = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/domains/dom_123')) {
          removeCalled = true
          return Promise.resolve(jsonResponse({}))
        }
        if (url.includes('/tenant/domains')) {
          return Promise.resolve(jsonResponse(domainsList))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(DomainDetail, { props: { id: 'dom_123' } })

    const removeBtn = await screen.findByRole('button', { name: 'Remove domain' })
    await fireEvent.click(removeBtn)

    // Remove dialog is open
    expect(
      screen.getByText(
        /Your storefront will become completely unreachable at https:\/\/shop\.example\.com/,
      ),
    ).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: 'I understand, remove this domain' })
    expect(confirmBtn).toBeDisabled()

    // Type incorrect hostname
    const input = screen.getByPlaceholderText('Type domain name to confirm')
    await fireEvent.input(input, { target: { value: 'wrong.example.com' } })
    expect(confirmBtn).toBeDisabled()

    // Type exact hostname
    await fireEvent.input(input, { target: { value: 'shop.example.com' } })
    expect(confirmBtn).not.toBeDisabled()

    await fireEvent.click(confirmBtn)
    expect(removeCalled).toBe(true)
  })

  it('cancels domain removal without calling remove API', async () => {
    let removeCalled = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/domains/dom_123')) {
          removeCalled = true
          return Promise.resolve(jsonResponse({}))
        }
        if (url.includes('/tenant/domains')) {
          return Promise.resolve(jsonResponse(domainsList))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(DomainDetail, { props: { id: 'dom_123' } })

    const removeBtn = await screen.findByRole('button', { name: 'Remove domain' })
    await fireEvent.click(removeBtn)

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    await fireEvent.click(cancelBtn)

    expect(removeCalled).toBe(false)
    expect(
      screen.queryByText(/Your storefront will become completely unreachable/),
    ).not.toBeInTheDocument()
  })

  it('has no accessibility violations on live detail view', async () => {
    const { container } = render(DomainDetail, { props: { id: 'dom_123' } })
    await screen.findByRole('heading', { name: 'shop.example.com', level: 1 })
    expect(await axe(container)).toHaveNoViolations()
  })
})
