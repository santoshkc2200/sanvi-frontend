import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
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

    // Danger zone with disabled action buttons
    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
    const makePrimaryBtn = screen.getByRole('button', { name: 'Set as primary domain' })
    const removeBtn = screen.getByRole('button', { name: 'Remove domain' })
    expect(makePrimaryBtn).toBeDisabled()
    expect(removeBtn).toBeDisabled()
    expect(makePrimaryBtn).toHaveAttribute(
      'title',
      'Primary domain management will be wired in Wave 4.',
    )
    expect(removeBtn).toHaveAttribute('title', 'Domain removal will be wired in Wave 4.')
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

  it('has no accessibility violations on live detail view', async () => {
    const { container } = render(DomainDetail, { props: { id: 'dom_123' } })
    await screen.findByRole('heading', { name: 'shop.example.com', level: 1 })
    expect(await axe(container)).toHaveNoViolations()
  })
})
