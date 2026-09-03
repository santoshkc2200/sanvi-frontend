import { setSession } from '@sanvi/auth'
import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PaymentDetail from '../src/routes/PaymentDetail.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const MOCK_DETAIL = {
  payment: {
    id: 'pay_123',
    external_payment_id: 'pi_stripe_123',
    checkout_id: 'chk_abc',
    amount_minor: 10000,
    currency: 'USD',
    status: 'succeeded',
    fee_minor: 320,
    fee_currency: 'USD',
    payout_status: 'paid',
    created_at: '2026-08-01T10:00:00Z',
    captured_at: '2026-08-01T10:02:00Z',
  },
  checkout_reference: 'Order #1001',
  refunds: [
    {
      id: 'ref_1',
      payment_id: 'pay_123',
      amount_minor: 2000,
      currency: 'USD',
      status: 'succeeded',
      reason: 'requested_by_customer',
      created_by: 'alice@example.com',
      created_at: '2026-08-02T14:00:00Z',
    },
  ],
  disputes: [
    {
      id: 'disp_1',
      payment_id: 'pay_123',
      external_dispute_id: 'dp_123',
      amount_minor: 10000,
      currency: 'USD',
      status: 'needs_response',
      reason: 'fraudulent',
      due_by: '2026-08-15T23:59:59Z',
      dashboard_url: 'https://dashboard.stripe.com/disputes/dp_123',
      created_at: '2026-08-03T09:00:00Z',
    },
  ],
  timeline: [
    {
      kind: 'created',
      at: '2026-08-01T10:00:00Z',
    },
    {
      kind: 'succeeded',
      at: '2026-08-01T10:02:00Z',
      amount: { amount_minor: 10000, currency: 'USD' },
    },
    {
      kind: 'refunded',
      at: '2026-08-02T14:00:00Z',
      amount: { amount_minor: 2000, currency: 'USD' },
      actor: 'alice@example.com',
      detail: 'Partial refund issued upon customer request',
    },
    {
      kind: 'disputed',
      at: '2026-08-03T09:00:00Z',
      detail: 'Cardholder claimed charge was fraudulent',
    },
  ],
}

describe('Admin PaymentDetail Route Component', () => {
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

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/v1/tenant/payments/pay_123')) {
          return Promise.resolve(jsonResponse(MOCK_DETAIL))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders payment summary, timeline projection as-is, refunds, and dispute state', async () => {
    render(PaymentDetail, { props: { id: 'pay_123' } })

    expect(await screen.findByRole('heading', { name: '$100.00' })).toBeInTheDocument()
    expect(screen.getByText('pi_stripe_123')).toBeInTheDocument()
    expect(screen.getByText('Order #1001')).toBeInTheDocument()

    // Timeline entries rendered
    expect(screen.getByText('Payment initiated')).toBeInTheDocument()
    expect(screen.getByText('Payment succeeded')).toBeInTheDocument()
    expect(screen.getByText('Payment refunded')).toBeInTheDocument()
    expect(screen.getByText('Dispute opened')).toBeInTheDocument()
    expect(screen.getByText('Partial refund issued upon customer request')).toBeInTheDocument()

    // Dispute state with deadline and deep link
    expect(screen.getByText('Submit evidence in Stripe')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Dispute responses and evidence must be submitted directly in the Stripe Dashboard/,
      ),
    ).toBeInTheDocument()
    const stripeLink = screen.getByRole('link', { name: /Respond in Stripe Dashboard/ })
    expect(stripeLink).toHaveAttribute('href', 'https://dashboard.stripe.com/disputes/dp_123')

    // Refunds history
    expect(screen.getByText('ref_1')).toBeInTheDocument()
    expect(screen.getAllByText('$20.00').length).toBeGreaterThan(0)
  })

  it('shows refund button when user has payments.refund permission', async () => {
    render(PaymentDetail, { props: { id: 'pay_123' } })
    expect(await screen.findByRole('button', { name: 'Refund payment' })).toBeInTheDocument()
  })

  it('hides refund button when user lacks payments.refund permission', async () => {
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
        permissions: ['payments.read'], // No payments.refund!
      },
    ])
    switchTenant('dev-acme')

    render(PaymentDetail, { props: { id: 'pay_123' } })
    await screen.findByRole('heading', { name: '$100.00' })

    expect(screen.queryByRole('button', { name: 'Refund payment' })).not.toBeInTheDocument()
  })

  it('renders fee line when fee_minor is present with proper money formatting', async () => {
    render(PaymentDetail, { props: { id: 'pay_123' } })
    await screen.findByRole('heading', { name: '$100.00' })

    expect(screen.getByText('Processing fee')).toBeInTheDocument()
    expect(screen.getByText('$3.20')).toBeInTheDocument()
  })

  it('renders JPY fee line with zero decimal formatting', async () => {
    const jpyDetail = {
      ...MOCK_DETAIL,
      payment: {
        ...MOCK_DETAIL.payment,
        currency: 'JPY',
        amount_minor: 5000,
        fee_minor: 180,
        fee_currency: 'JPY',
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/v1/tenant/payments/pay_123')) {
          return Promise.resolve(jsonResponse(jpyDetail))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentDetail, { props: { id: 'pay_123' } })
    await screen.findByRole('heading', { name: '¥5,000' })

    expect(screen.getByText('Processing fee')).toBeInTheDocument()
    expect(screen.getByText('¥180')).toBeInTheDocument()
  })

  it('does not render fee line when fee_minor is null or undefined', async () => {
    const noFeeDetail = {
      ...MOCK_DETAIL,
      payment: {
        ...MOCK_DETAIL.payment,
        fee_minor: null,
        fee_currency: null,
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/v1/tenant/payments/pay_123')) {
          return Promise.resolve(jsonResponse(noFeeDetail))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(PaymentDetail, { props: { id: 'pay_123' } })
    await screen.findByRole('heading', { name: '$100.00' })

    expect(screen.queryByText('Processing fee')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(PaymentDetail, { props: { id: 'pay_123' } })
    await screen.findByRole('heading', { name: '$100.00' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
