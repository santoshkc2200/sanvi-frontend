import { render, screen, waitFor } from '@testing-library/svelte'
import { initI18n } from '@sanvi/i18n'
import { describe, expect, it, vi } from 'vitest'
import CheckoutReturnPage from '../src/routes/checkout/return/+page.svelte'
import { ApiError } from '@sanvi/api-client'
import * as checkoutModule from '../src/lib/checkout'
import { getDeclineMessage } from '../src/lib/checkout/decline-codes'
import type { CheckoutView } from '../src/lib/checkout/types'

describe('Checkout Return route component', () => {
  initI18n({ locale: 'en' })

  it('renders not found error when checkoutId is absent', () => {
    render(CheckoutReturnPage, {
      props: {
        data: {
          checkoutId: null,
        },
      },
    })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Order not found')
    expect(screen.getByText("We couldn't find the requested checkout session.")).toBeInTheDocument()
  })

  it('renders confirmation view when polling resolves to paid', async () => {
    const paidCheckout: CheckoutView = {
      id: 'chk_paid_1',
      amount_minor: 4800,
      currency: 'USD',
      reference: 'ord-ret-001',
      status: 'paid',
      conversion_event_id: 'conv_ret_001',
      created_at: new Date().toISOString(),
    }

    vi.spyOn(checkoutModule, 'pollCheckoutStatus').mockResolvedValueOnce(paidCheckout)

    render(CheckoutReturnPage, {
      props: {
        data: {
          checkoutId: 'chk_paid_1',
        },
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment confirmed')
      expect(screen.getByText('Order reference: ord-ret-001')).toBeInTheDocument()
      expect(screen.getByText('Amount paid')).toBeInTheDocument()
    })
  })

  it('holds confirming state and displays delayed reassurance notice on webhook lag (never false failure)', async () => {
    const pendingCheckout: CheckoutView = {
      id: 'chk_lag_1',
      amount_minor: 4800,
      currency: 'USD',
      reference: 'ord-lag-001',
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    vi.spyOn(checkoutModule, 'pollCheckoutStatus').mockImplementationOnce(
      async (_client, _id, options) => {
        options?.onDelayed?.()
        return pendingCheckout
      },
    )

    render(CheckoutReturnPage, {
      props: {
        data: {
          checkoutId: 'chk_lag_1',
        },
      },
    })

    await waitFor(() => {
      expect(
        screen.getByText(
          "Payment confirmation is taking longer than usual. We'll send your receipt and order details by email as soon as it completes.",
        ),
      ).toBeInTheDocument()
      // Never render false failure for pending order
      expect(screen.queryByText(/Payment failed/i)).not.toBeInTheDocument()
    })
  })

  it('distinguishes polling/network failure from payment failure by rendering delayed state (Defect 5)', async () => {
    vi.spyOn(checkoutModule, 'pollCheckoutStatus').mockRejectedValueOnce(
      new Error('Network timeout after 30s'),
    )

    render(CheckoutReturnPage, {
      props: {
        data: {
          checkoutId: 'chk_net_fail',
        },
      },
    })

    await waitFor(() => {
      // Must NOT show payment failed
      expect(screen.queryByRole('heading', { name: 'Payment failed' })).not.toBeInTheDocument()
      // Must land in delayed reassurance state
      expect(
        screen.getByText(
          "Payment confirmation is taking longer than usual. We'll send your receipt and order details by email as soon as it completes.",
        ),
      ).toBeInTheDocument()
    })
  })

  it('renders generic failure message when server status is failed (Defect 6)', async () => {
    const failedCheckout: CheckoutView = {
      id: 'chk_failed_1',
      amount_minor: 4800,
      currency: 'USD',
      reference: 'ord-fail-001',
      status: 'failed',
      created_at: new Date().toISOString(),
    }

    vi.spyOn(checkoutModule, 'pollCheckoutStatus').mockResolvedValueOnce(failedCheckout)

    render(CheckoutReturnPage, {
      props: {
        data: {
          checkoutId: 'chk_failed_1',
        },
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment failed')
      expect(
        screen.getByText("We couldn't process your payment. Please try again or contact support."),
      ).toBeInTheDocument()
    })
  })

  it('renders canceled heading and notice when checkout status is canceled (Defect 7)', async () => {
    const canceledCheckout: CheckoutView = {
      id: 'chk_canceled_1',
      amount_minor: 4800,
      currency: 'USD',
      reference: 'ord-cancel-001',
      status: 'canceled',
      created_at: new Date().toISOString(),
    }

    vi.spyOn(checkoutModule, 'pollCheckoutStatus').mockResolvedValueOnce(canceledCheckout)

    render(CheckoutReturnPage, {
      props: {
        data: {
          checkoutId: 'chk_canceled_1',
        },
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment canceled')
      expect(screen.getByText('Payment was canceled. Your cart is intact.')).toBeInTheDocument()
    })
  })

  it('retains pending checkout id on terminal paid state for refresh support, and clears cart and idempotency key', async () => {
    sessionStorage.setItem('sanvi_pending_checkout_id', 'chk_paid_term')
    sessionStorage.setItem('sanvi_checkout_idempotency_key', 'idem_key_123')

    const paidCheckout: CheckoutView = {
      id: 'chk_paid_term',
      amount_minor: 4800,
      currency: 'USD',
      reference: 'ord-paid-term',
      status: 'paid',
      created_at: new Date().toISOString(),
    }

    vi.spyOn(checkoutModule, 'pollCheckoutStatus').mockResolvedValueOnce(paidCheckout)

    const cart = checkoutModule.createCart()
    render(CheckoutReturnPage, {
      props: {
        data: {
          checkoutId: 'chk_paid_term',
        },
        cart,
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment confirmed')
    })

    expect(sessionStorage.getItem('sanvi_pending_checkout_id')).toBe('chk_paid_term')
    expect(sessionStorage.getItem('sanvi_checkout_idempotency_key')).toBeNull()
    expect(cart.items).toEqual([])
  })

  it('retains pending checkout id on terminal canceled state so a refresh still shows the reason', async () => {
    sessionStorage.setItem('sanvi_pending_checkout_id', 'chk_canceled_term')
    sessionStorage.setItem('sanvi_checkout_idempotency_key', 'idem_key_456')

    const canceledCheckout: CheckoutView = {
      id: 'chk_canceled_term',
      amount_minor: 4800,
      currency: 'USD',
      reference: 'ord-canceled-term',
      status: 'canceled',
      created_at: new Date().toISOString(),
    }

    vi.spyOn(checkoutModule, 'pollCheckoutStatus').mockResolvedValueOnce(canceledCheckout)

    render(CheckoutReturnPage, {
      props: {
        data: {
          checkoutId: 'chk_canceled_term',
        },
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment canceled')
    })

    expect(sessionStorage.getItem('sanvi_pending_checkout_id')).toBe('chk_canceled_term')
    expect(sessionStorage.getItem('sanvi_checkout_idempotency_key')).toBeNull()
  })

  it('renders the specific decline copy the server names, not the generic message', async () => {
    const declinedCheckout: CheckoutView = {
      id: 'chk_declined',
      amount_minor: 4800,
      currency: 'USD',
      reference: 'ord-declined',
      status: 'failed',
      failure_code: 'insufficient_funds',
      created_at: new Date().toISOString(),
    }

    vi.spyOn(checkoutModule, 'pollCheckoutStatus').mockResolvedValueOnce(declinedCheckout)

    render(CheckoutReturnPage, {
      props: {
        data: {
          checkoutId: 'chk_declined',
        },
      },
    })

    await waitFor(() => {
      expect(screen.getByText(getDeclineMessage('insufficient_funds'))).toBeInTheDocument()
    })
    expect(screen.queryByText(getDeclineMessage(null))).not.toBeInTheDocument()
  })

  it('surfaces non-retryable ApiError as not_found rather than delayed (Defect 4)', async () => {
    const notFoundError = new ApiError(
      404,
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
      },
      undefined,
    )

    vi.spyOn(checkoutModule, 'pollCheckoutStatus').mockRejectedValueOnce(notFoundError)

    render(CheckoutReturnPage, {
      props: {
        data: {
          checkoutId: 'chk_stale_or_foreign',
        },
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Order not found')
      expect(
        screen.getByText("We couldn't find the requested checkout session."),
      ).toBeInTheDocument()
    })
  })

  it('resets per-attempt state when checkoutId changes (Defect 11)', async () => {
    const pendingCheckout1: CheckoutView = {
      id: 'chk_first',
      amount_minor: 1000,
      currency: 'USD',
      reference: 'ord-1',
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    const paidCheckout2: CheckoutView = {
      id: 'chk_second',
      amount_minor: 2000,
      currency: 'USD',
      reference: 'ord-2',
      status: 'paid',
      created_at: new Date().toISOString(),
    }

    vi.spyOn(checkoutModule, 'pollCheckoutStatus').mockImplementation(
      async (_client, id, options) => {
        if (id === 'chk_first') {
          options?.onDelayed?.()
          return pendingCheckout1
        }
        return paidCheckout2
      },
    )

    const { rerender } = render(CheckoutReturnPage, {
      props: {
        data: {
          checkoutId: 'chk_first',
        },
      },
    })

    await waitFor(() => {
      expect(
        screen.getByText(
          "Payment confirmation is taking longer than usual. We'll send your receipt and order details by email as soon as it completes.",
        ),
      ).toBeInTheDocument()
    })

    // Rerender with different checkout ID
    rerender({
      data: {
        checkoutId: 'chk_second',
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment confirmed')
      expect(screen.getByText('Order reference: ord-2')).toBeInTheDocument()
      expect(
        screen.queryByText(
          "Payment confirmation is taking longer than usual. We'll send your receipt and order details by email as soon as it completes.",
        ),
      ).not.toBeInTheDocument()
    })
  })
})
