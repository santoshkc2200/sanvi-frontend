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
