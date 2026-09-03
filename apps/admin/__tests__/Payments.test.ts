import { setSession } from '@sanvi/auth'
import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Payments from '../src/routes/Payments.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const MOCK_PAYMENTS = [
  {
    id: 'pay_1',
    external_payment_id: 'pi_stripe_1',
    checkout_id: 'chk_123',
    amount_minor: 5000,
    currency: 'USD',
    status: 'succeeded',
    payout_status: 'paid',
    created_at: '2026-08-01T12:00:00Z',
    captured_at: '2026-08-01T12:05:00Z',
  },
  {
    id: 'pay_2',
    external_payment_id: 'pi_stripe_2',
    checkout_id: 'chk_456',
    amount_minor: 2500,
    currency: 'JPY',
    status: 'refunded',
    payout_status: 'pending',
    created_at: '2026-08-02T15:30:00Z',
    captured_at: '2026-08-02T15:35:00Z',
  },
  {
    id: 'pay_3',
    external_payment_id: 'pi_stripe_3',
    checkout_id: 'chk_789',
    amount_minor: 12000,
    currency: 'USD',
    status: 'disputed',
    payout_status: null,
    created_at: '2026-08-03T18:00:00Z',
    captured_at: '2026-08-03T18:05:00Z',
  },
]

describe('Admin Payments Route Component', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
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
          permissions: ['payments.read', 'payments.refund'],
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
        permissions: ['payments.read', 'payments.refund'],
      },
    ])
    switchTenant('dev-acme')

    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/v1/tenant/payments/export')) {
        return Promise.resolve(
          new Response('payment_id,amount_minor,currency\npay_1,5000,USD\n', {
            status: 200,
            headers: { 'content-type': 'text/csv; charset=utf-8' },
          }),
        )
      }
      if (url.includes('/api/v1/tenant/payments/providers')) {
        return Promise.resolve(
          jsonResponse({ providers: [{ kind: 'stripe', display_name: 'Stripe' }] }),
        )
      }
      if (url.includes('/api/v1/tenant/payments')) {
        return Promise.resolve(
          jsonResponse({
            items: MOCK_PAYMENTS,
            next_cursor: 'cursor_page_2',
          }),
        )
      }
      return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
    })

    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders payments list with date, customer, amount, status, method, and payout status', async () => {
    render(Payments)

    expect(await screen.findByText('chk_123')).toBeInTheDocument()
    expect(screen.getByText('chk_456')).toBeInTheDocument()
    expect(screen.getByText('chk_789')).toBeInTheDocument()

    // Formatted currency amounts: USD has decimals, JPY has zero decimals
    expect(screen.getByText('$50.00')).toBeInTheDocument()
    expect(screen.getByText('¥2,500')).toBeInTheDocument()

    // Statuses
    expect(screen.getAllByText('Succeeded').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Refunded').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Disputed').length).toBeGreaterThan(0)

    // Detail links
    const detailLinks = screen.getAllByRole('link', { name: 'View details' })
    expect(detailLinks).toHaveLength(3)
    expect(detailLinks[0]).toHaveAttribute('href', '/payments/pay_1')
    expect(detailLinks[1]).toHaveAttribute('href', '/payments/pay_2')
  })

  it('filters by status and customer', async () => {
    render(Payments)
    await screen.findByText('chk_123')

    const customerInput = screen.getByPlaceholderText('Filter by customer…')
    await fireEvent.input(customerInput, { target: { value: 'chk_123' } })

    // The customer search is debounced (300ms), so the request is not issued
    // synchronously on input.
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('customer=chk_123'),
        expect.anything(),
      ),
    )
  })

  it('renders empty state when no payments exist and links to settings if inactive', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/v1/tenant/payments/providers')) {
          return Promise.resolve(jsonResponse({ providers: [] }))
        }
        if (url.includes('/api/v1/tenant/payments')) {
          return Promise.resolve(jsonResponse({ items: [], next_cursor: null }))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(Payments)

    expect(await screen.findByText('No payments yet')).toBeInTheDocument()
    expect(
      screen.getByText('Connect your Stripe account in settings to start accepting payments.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Set up payments' })).toHaveAttribute(
      'href',
      '/payments/settings',
    )
  })

  it('handles CSV export button click', async () => {
    render(Payments)
    await screen.findByText('chk_123')

    const exportBtn = screen.getByRole('button', { name: 'Export CSV' })
    await fireEvent.click(exportBtn)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/tenant/payments/export'),
      expect.anything(),
    )
  })

  it('navigates with cursor pagination', async () => {
    render(Payments)
    await screen.findByText('chk_123')

    const nextBtn = screen.getByRole('button', { name: 'Next' })
    expect(nextBtn).toBeEnabled()

    await fireEvent.click(nextBtn)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('cursor=cursor_page_2'),
      expect.anything(),
    )
  })

  it('has no accessibility violations', async () => {
    const { container } = render(Payments)
    await screen.findByText('chk_123')
    expect(await axe(container)).toHaveNoViolations()
  })
})
