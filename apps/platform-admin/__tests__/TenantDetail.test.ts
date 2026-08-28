import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TenantDetail from '../src/routes/TenantDetail.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const MOCK_TENANT = {
  id: 'tenant-123',
  slug: 'test-tenant',
  display_name: 'Test Tenant',
  region: 'us',
  default_locale: 'en',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const MOCK_ADMIN_VIEW = {
  id: 'tenant-123',
  slug: 'test-tenant',
  display_name: 'Test Tenant',
  status: 'active',
  member_count: 5,
  override_count: 0,
  active_impersonations: 0,
  created_at: '2026-01-01T00:00:00Z',
}

const MOCK_SUBSCRIPTION_OVERRIDE = {
  subscription_id: 'sub-override-123',
  plan_key: 'enterprise',
  plan_name: 'Enterprise',
  source: 'override',
  status: 'active',
  collection_state: 'ok',
  current_period: {
    start: '2026-08-01T00:00:00Z',
    end: '2026-09-01T00:00:00Z',
  },
}

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (input instanceof Request) return input.url
  return String(input)
}

function mockFetch(input: RequestInfo | URL): Promise<Response> {
  const url = getUrl(input)
  if (url.includes('/platform/tenants/tenant-123/entitlements')) {
    return Promise.resolve(jsonResponse([]))
  }
  if (url.includes('/platform/features')) {
    return Promise.resolve(jsonResponse([]))
  }
  if (url.includes('/platform/audit')) {
    return Promise.resolve(jsonResponse({ entries: [], has_more: false }))
  }
  if (url.includes('/platform/admin/tenants/tenant-123')) {
    return Promise.resolve(jsonResponse(MOCK_ADMIN_VIEW))
  }
  if (url.includes('/platform/tenants/tenant-123/subscription/override')) {
    return Promise.resolve(jsonResponse({}, 204))
  }
  if (url.includes('/platform/tenants/tenant-123')) {
    return Promise.resolve(jsonResponse(MOCK_TENANT))
  }
  if (url.includes('/tenant/billing/subscription')) {
    return Promise.resolve(jsonResponse(MOCK_SUBSCRIPTION_OVERRIDE))
  }
  return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(mockFetch))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Platform Admin TenantDetail Subscription Tab (Defect 15)', () => {
  it('renders subscription details and active override with period', async () => {
    render(TenantDetail, { props: { id: 'tenant-123' } })

    expect(await screen.findByText('Test Tenant')).toBeInTheDocument()

    const subTab = screen.getByRole('link', { name: 'Subscription' })
    await fireEvent.click(subTab)

    expect(await screen.findByText(/Enterprise \(override\)/)).toBeInTheDocument()
    expect(screen.getByText('Current period:')).toBeInTheDocument()
    expect(screen.getByText('2026-08-01')).toBeInTheDocument()
    expect(screen.getByText('2026-09-01')).toBeInTheDocument()

    const revokeBtn = screen.getByRole('button', { name: 'Revoke override' })
    expect(revokeBtn).not.toBeDisabled()
  })

  it('opens confirmation Dialog when Revoke override is clicked and sends delete request on confirm', async () => {
    let deleteCalled = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = getUrl(input)
        const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
        if (
          url.includes('/platform/tenants/tenant-123/subscription/override') &&
          method === 'DELETE'
        ) {
          deleteCalled = true
          return Promise.resolve(jsonResponse({}, 204))
        }
        return mockFetch(input)
      }),
    )

    render(TenantDetail, { props: { id: 'tenant-123' } })
    await screen.findByText('Test Tenant')

    const subTab = screen.getByRole('link', { name: 'Subscription' })
    await fireEvent.click(subTab)

    const revokeBtn = await screen.findByRole('button', { name: 'Revoke override' })
    await fireEvent.click(revokeBtn)

    expect(
      screen.getAllByText(
        'This removes the tenant-specific override. The feature falls back to its plan or catalog default immediately.',
      ).length,
    ).toBeGreaterThan(0)

    const confirmBtns = screen.getAllByRole('button', { name: 'Revoke override' })
    const dialogConfirmBtn = confirmBtns[confirmBtns.length - 1]!
    await fireEvent.click(dialogConfirmBtn)

    await waitFor(() => {
      expect(deleteCalled).toBe(true)
    })
  })

  it('disables Revoke override button and renders no subscription message when subscription is null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = getUrl(input)
        if (url.includes('/tenant/billing/subscription')) {
          return Promise.resolve(jsonResponse(null))
        }
        return mockFetch(input)
      }),
    )

    render(TenantDetail, { props: { id: 'tenant-123' } })
    await screen.findByText('Test Tenant')

    const subTab = screen.getByRole('link', { name: 'Subscription' })
    await fireEvent.click(subTab)

    expect(await screen.findByText('No active subscription for this tenant.')).toBeInTheDocument()

    const revokeBtn = screen.getByRole('button', { name: 'Revoke override' })
    expect(revokeBtn).toBeDisabled()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(TenantDetail, { props: { id: 'tenant-123' } })
    await screen.findByText('Test Tenant')
    expect(await axe(container)).toHaveNoViolations()
  })
})
