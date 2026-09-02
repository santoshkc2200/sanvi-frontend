import { setSession } from '@sanvi/auth'
import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RefundDialog from '../src/lib/payments/RefundDialog.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const MOCK_USD_PAYMENT = {
  id: 'pay_usd',
  external_payment_id: 'pi_usd',
  amount_minor: 10000,
  currency: 'USD',
  status: 'succeeded',
}

const MOCK_JPY_PAYMENT = {
  id: 'pay_jpy',
  external_payment_id: 'pi_jpy',
  amount_minor: 5000,
  currency: 'JPY',
  status: 'succeeded',
}

describe('RefundDialog Component', () => {
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

    fetchMock = vi.fn(() => {
      return Promise.resolve(
        jsonResponse({
          id: 'ref_new',
          payment_id: 'pay_usd',
          amount_minor: 10000,
          currency: 'USD',
          status: 'succeeded',
          created_at: '2026-08-01T12:00:00Z',
        }),
      )
    })

    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders refund dialog with available balance and reason field', async () => {
    render(RefundDialog, {
      props: {
        open: true,
        payment: MOCK_USD_PAYMENT,
        refunds: [
          {
            id: 'ref_1',
            payment_id: 'pay_usd',
            amount_minor: 3000,
            currency: 'USD',
            status: 'succeeded',
            created_at: '2026-08-01T00:00:00Z',
          },
        ],
      },
    })

    expect(await screen.findByRole('heading', { name: 'Issue refund' })).toBeInTheDocument()
    // Available to refund = 10000 - 3000 = $70.00
    expect(screen.getAllByText('$70.00').length).toBeGreaterThan(0)
  })

  it('handles JPY zero-decimal formatting everywhere in the flow', async () => {
    render(RefundDialog, {
      props: {
        open: true,
        payment: MOCK_JPY_PAYMENT,
        refunds: [
          {
            id: 'ref_j1',
            payment_id: 'pay_jpy',
            amount_minor: 1500,
            currency: 'JPY',
            status: 'succeeded',
            created_at: '2026-08-01T00:00:00Z',
          },
        ],
      },
    })

    expect(await screen.findByRole('heading', { name: 'Issue refund' })).toBeInTheDocument()
    // Available to refund = 5000 - 1500 = ¥3,500 (zero decimals)
    expect(screen.getAllByText('¥3,500').length).toBeGreaterThan(0)
    expect(screen.queryByText('35.00')).not.toBeInTheDocument()
    expect(screen.queryByText('3500.00')).not.toBeInTheDocument()
  })

  it('disables submit button when reason is not selected', async () => {
    render(RefundDialog, {
      props: {
        open: true,
        payment: MOCK_USD_PAYMENT,
      },
    })

    const submitBtn = await screen.findByRole('button', { name: 'Issue refund' })
    expect(submitBtn).toBeDisabled()

    // Select reason
    const reasonSelect = screen.getByRole('combobox')
    await fireEvent.change(reasonSelect, { target: { value: 'requested_by_customer' } })

    expect(submitBtn).toBeEnabled()
  })

  it('keeps idempotency key stable across retries / double submissions within dialog open', async () => {
    let callCount = 0
    fetchMock = vi.fn(() => {
      callCount += 1
      if (callCount === 1) {
        return Promise.resolve(jsonResponse({ title: 'Invalid parameter', status: 400 }, 400))
      }
      return Promise.resolve(
        jsonResponse({
          id: 'ref_retry',
          payment_id: 'pay_usd',
          amount_minor: 10000,
          currency: 'USD',
          status: 'succeeded',
          created_at: '2026-08-01T12:00:00Z',
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(RefundDialog, {
      props: {
        open: true,
        payment: MOCK_USD_PAYMENT,
      },
    })

    const reasonSelect = await screen.findByRole('combobox')
    await fireEvent.change(reasonSelect, { target: { value: 'duplicate' } })

    const submitBtn = screen.getByRole('button', { name: 'Issue refund' })

    // First submit attempt (fails with 400)
    await fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled()
    })

    const firstCallHeaders = fetchMock.mock.calls[0][1].headers
    const firstIdempotencyKey = firstCallHeaders['idempotency-key']
    expect(firstIdempotencyKey).toBeDefined()

    // Second submit attempt (retry)
    await fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    const secondCallHeaders = fetchMock.mock.calls[1][1].headers
    const secondIdempotencyKey = secondCallHeaders['idempotency-key']

    // Must be exactly the SAME idempotency key!
    expect(secondIdempotencyKey).toBe(firstIdempotencyKey)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(RefundDialog, {
      props: {
        open: true,
        payment: MOCK_USD_PAYMENT,
      },
    })
    await screen.findByRole('heading', { name: 'Issue refund' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
