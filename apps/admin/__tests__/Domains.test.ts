import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Domains from '../src/routes/Domains.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const MOCK_DOMAINS = [
  {
    id: 'dom_1',
    hostname: 'example.com',
    kind: 'connected',
    role: 'primary',
    status: 'live',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'dom_2',
    hostname: 'shop.example.com',
    kind: 'connected',
    role: 'alias',
    status: 'verifying',
    created_at: '2026-08-02T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
    failure: {
      code: 'txt_missing',
      detail: 'TXT record not observed yet',
    },
  },
]

function mockFetch(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  if (url.includes('/tenant/domains')) {
    return Promise.resolve(jsonResponse(MOCK_DOMAINS))
  }
  return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
}

beforeEach(() => {
  setMemberships([
    { tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' },
    { tenantId: 'dev-unentitled', slug: 'unentitled', displayName: 'Unentitled', role: 'owner' },
    { tenantId: 'dev-empty', slug: 'empty', displayName: 'Empty', role: 'owner' },
    { tenantId: 'dev-error', slug: 'error', displayName: 'Error Corp', role: 'owner' },
  ])
  switchTenant('dev-acme')
  vi.stubGlobal('fetch', vi.fn(mockFetch))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Admin Domains Route Component', () => {
  it('renders the populated domains table with hostnames, roles, statuses and details links', async () => {
    render(Domains)

    expect(await screen.findByText('example.com')).toBeInTheDocument()
    expect(screen.getByText('shop.example.com')).toBeInTheDocument()
    expect(screen.getByText('Primary')).toBeInTheDocument()
    expect(screen.getByText('Alias')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByText('Verifying')).toBeInTheDocument()
    expect(screen.getByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('Degraded')).toBeInTheDocument()

    const detailsLinks = screen.getAllByRole('link', { name: 'View details' })
    expect(detailsLinks).toHaveLength(2)
    expect(detailsLinks[0]).toHaveAttribute('href', '/domains/dom_1')
    expect(detailsLinks[1]).toHaveAttribute('href', '/domains/dom_2')
  })

  it('renders empty state when no domains exist', async () => {
    switchTenant('dev-empty')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/domains')) {
          return Promise.resolve(jsonResponse([]))
        }
        return mockFetch(input)
      }),
    )

    render(Domains)

    expect(await screen.findByText('No custom domains configured')).toBeInTheDocument()
    expect(
      screen.getByText('Connect a domain you already own to brand your storefront.'),
    ).toBeInTheDocument()
  })

  it('renders upgrade prompt when tenant lacks domains.custom entitlement (403/404)', async () => {
    switchTenant('dev-unentitled')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/domains')) {
          return Promise.resolve(
            jsonResponse(
              {
                title: 'Forbidden',
                status: 403,
                detail: 'Feature not enabled for this tenant: domains.custom',
              },
              403,
            ),
          )
        }
        return mockFetch(input)
      }),
    )

    render(Domains)

    expect(await screen.findByText('Custom domains require an upgrade')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Custom domains require a plan with custom domain support. Ask a tenant owner to upgrade.',
      ),
    ).toBeInTheDocument()
  })

  it('renders error alert when loading fails with 500', async () => {
    switchTenant('dev-error')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/domains')) {
          return Promise.resolve(jsonResponse({ title: 'Internal Server Error' }, 500))
        }
        return mockFetch(input)
      }),
    )

    render(Domains)

    expect(
      await screen.findByText(
        'Could not load custom domains. Please try again in a moment.',
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(Domains)
    await screen.findByText('example.com')
    expect(await axe(container)).toHaveNoViolations()
  })
})
