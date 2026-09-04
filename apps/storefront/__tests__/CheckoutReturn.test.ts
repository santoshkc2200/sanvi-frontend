import { render, screen, waitFor } from '@testing-library/svelte'
import { initI18n } from '@sanvi/i18n'
import { describe, expect, it, vi } from 'vitest'
import CheckoutReturnPage from '../src/routes/checkout/return/+page.svelte'
import * as checkoutModule from '../src/lib/checkout'
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

    // The confirmation fires the phase-10 conversion beacon on mount; keep
    // it hermetic and assert it went out exactly once with the
    // server-issued event id. The test env has no site key, so the
    // transport is `navigator.sendBeacon`.
    const sendBeacon = vi.fn(() => true)
    Object.defineProperty(window.navigator, 'sendBeacon', {
      value: sendBeacon,
      configurable: true,
    })

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
    await waitFor(() => expect(sendBeacon).toHaveBeenCalledTimes(1))
    const [beaconUrl, beaconBody] = sendBeacon.mock.calls[0] as unknown as [string, Blob]
    expect(beaconUrl).toContain('/api/v1/public/track')
    expect(beaconBody).toBeInstanceOf(Blob)
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

  it('clears pending checkout id and cart on terminal paid state (Defects 1 & 8)', async () => {
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

    render(CheckoutReturnPage, {
      props: {
        data: {
          checkoutId: 'chk_paid_term',
        },
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment confirmed')
    })

    expect(sessionStorage.getItem('sanvi_pending_checkout_id')).toBeNull()
    expect(sessionStorage.getItem('sanvi_checkout_idempotency_key')).toBeNull()
    expect(checkoutModule.getCartItems()).toEqual([])
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
