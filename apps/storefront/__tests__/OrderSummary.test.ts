import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { initI18n } from '@sanvi/i18n'
import { describe, expect, it, vi } from 'vitest'
import OrderSummary from '../src/lib/checkout/OrderSummary.svelte'
import type { OrderItem } from '../src/lib/checkout/types'

describe('OrderSummary component', () => {
  initI18n({ locale: 'en' })

  const sampleItems: OrderItem[] = [
    {
      id: 'item-1',
      name: 'Modern Web Course',
      quantity: 1,
      amount_minor: 4800,
      description: 'Full course access',
    },
    {
      id: 'item-2',
      name: 'Worksheet Bundle',
      quantity: 2,
      amount_minor: 1200,
    },
  ]

  it('renders items, static tax note, subtotal and total', () => {
    render(OrderSummary, {
      props: {
        items: sampleItems,
        currency: 'USD',
      },
    })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Order summary')
    expect(screen.getByText('Modern Web Course')).toBeInTheDocument()
    expect(screen.getByText('Worksheet Bundle')).toBeInTheDocument()
    expect(
      screen.getByText('Taxes may apply and will be calculated during payment.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('$72.00').length).toBeGreaterThanOrEqual(1)
  })

  it('formats JPY with no decimals across the entire summary', () => {
    const jpyItems: OrderItem[] = [
      {
        id: 'item-jpy',
        name: 'Design System Masterclass',
        quantity: 1,
        amount_minor: 2000,
      },
    ]

    render(OrderSummary, {
      props: {
        items: jpyItems,
        currency: 'JPY',
      },
    })

    // JPY formatting in en or ja locale has zero decimals
    const prices = screen.getAllByText(/2,000/)
    expect(prices.length).toBeGreaterThan(0)
    for (const el of prices) {
      expect(el.textContent).not.toContain('.00')
    }
  })

  it('disables buy button with visible reason when account cannot accept payments', async () => {
    render(OrderSummary, {
      props: {
        items: sampleItems,
        canAcceptPayments: false,
        cannotAcceptReason: 'This store cannot accept payments right now.',
      },
    })

    const button = screen.getByRole('button', { name: 'Proceed to checkout' })
    expect(button).toBeDisabled()
    expect(
      screen.getAllByText('This store cannot accept payments right now.').length,
    ).toBeGreaterThan(0)
  })

  it('invokes onInitiateCheckout with a fresh idempotency key when clicked', async () => {
    const onInitiateCheckout = vi.fn()
    render(OrderSummary, {
      props: {
        items: sampleItems,
        canAcceptPayments: true,
        onInitiateCheckout,
      },
    })

    const button = screen.getByRole('button', { name: 'Proceed to checkout' })
    await fireEvent.click(button)

    expect(onInitiateCheckout).toHaveBeenCalledOnce()
    const idempotencyKey = onInitiateCheckout.mock.calls[0][0]
    expect(typeof idempotencyKey).toBe('string')
    expect(idempotencyKey.length).toBeGreaterThan(10)
  })

  it('renders canceled notice when returning from cancel path', () => {
    render(OrderSummary, {
      props: {
        items: sampleItems,
        canceled: true,
      },
    })

    expect(screen.getByText('Payment was canceled. Your cart is intact.')).toBeInTheDocument()
  })

  it('handles response without url by displaying generic error and resetting button (Defect 2)', async () => {
    sessionStorage.clear()
    const createTenantCheckoutSpy = vi
      .spyOn(await import('@sanvi/api-client'), 'createTenantCheckout')
      .mockResolvedValueOnce({
        id: 'chk_no_url',
        amount_minor: 7200,
        currency: 'USD',
        reference: 'order-123',
        status: 'expired',
        created_at: new Date().toISOString(),
      } as unknown as import('../src/lib/checkout/types').CheckoutView)

    render(OrderSummary, {
      props: {
        items: sampleItems,
        currency: 'USD',
      },
    })

    const button = screen.getByRole('button', { name: 'Proceed to checkout' })
    await fireEvent.click(button)

    expect(createTenantCheckoutSpy).toHaveBeenCalledOnce()
    expect(
      await screen.findByText(
        "We couldn't process your payment. Please try again or contact support.",
      ),
    ).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it('generates a valid fallback UUID when crypto.randomUUID is undefined (Defect 3)', async () => {
    sessionStorage.clear()
    const originalRandomUUID = crypto.randomUUID
    try {
      // @ts-expect-error simulating non-secure context
      delete crypto.randomUUID

      const onInitiateCheckout = vi.fn()
      render(OrderSummary, {
        props: {
          items: sampleItems,
          onInitiateCheckout,
        },
      })

      const button = screen.getByRole('button', { name: 'Proceed to checkout' })
      await fireEvent.click(button)

      expect(onInitiateCheckout).toHaveBeenCalledOnce()
      const key = onInitiateCheckout.mock.calls[0][0]
      expect(typeof key).toBe('string')
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect(button).not.toBeDisabled()
    } finally {
      crypto.randomUUID = originalRandomUUID
    }
  })

  it('reuses stable idempotency key across retry clicks of the same cart (Defect 4)', async () => {
    sessionStorage.clear()
    const keysPassed: string[] = []
    const onInitiateCheckout = vi.fn(async (key: string) => {
      keysPassed.push(key)
      throw new Error('Timeout')
    })

    render(OrderSummary, {
      props: {
        items: sampleItems,
        onInitiateCheckout,
      },
    })

    const button = screen.getByRole('button', { name: 'Proceed to checkout' })
    await fireEvent.click(button)
    await fireEvent.click(button)

    expect(keysPassed.length).toBe(2)
    // Both clicks must share the exact same idempotency key
    expect(keysPassed[0]).toBe(keysPassed[1])
  })

  it('renders tax calculation note when taxEnabled is true', async () => {
    render(OrderSummary, {
      props: {
        items: sampleItems,
        taxEnabled: true,
      },
    })

    expect(
      screen.getByText('Taxes may apply and will be calculated during payment.'),
    ).toBeInTheDocument()
  })

  it('renders taxes not collected note when taxEnabled is false', async () => {
    render(OrderSummary, {
      props: {
        items: sampleItems,
        taxEnabled: false,
      },
    })

    expect(screen.getByText('Taxes are not collected for this order.')).toBeInTheDocument()
    expect(
      screen.queryByText('Taxes may apply and will be calculated during payment.'),
    ).not.toBeInTheDocument()
  })

  it('renders distinct provider-unavailable message on payments/provider-unavailable error', async () => {
    sessionStorage.clear()
    const { ApiError } = await import('@sanvi/api-client')
    const providerUnavailableError = new ApiError(
      502,
      {
        type: 'payments/provider-unavailable',
        title: 'Payment provider unavailable',
        status: 502,
      },
      'req_123',
    )

    vi.spyOn(await import('@sanvi/api-client'), 'createTenantCheckout').mockRejectedValueOnce(
      providerUnavailableError,
    )

    render(OrderSummary, {
      props: {
        items: sampleItems,
        currency: 'USD',
      },
    })

    const button = screen.getByRole('button', { name: 'Proceed to checkout' })
    await fireEvent.click(button)

    expect(
      await screen.findByText('Payments are temporarily unavailable. Please try again shortly.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("We couldn't process your payment. Please try again or contact support."),
    ).not.toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it('passes axe accessibility checks', async () => {
    const { container } = render(OrderSummary, {
      props: {
        items: sampleItems,
        currency: 'JPY',
      },
    })

    expect(await axe(container)).toHaveNoViolations()
  })
})
