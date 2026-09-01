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

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment failed')
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

  it('renders specific card decline message when checkout failed', async () => {
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
        screen.getByText('Your card was declined — please try another payment method.'),
      ).toBeInTheDocument()
    })
  })
})
