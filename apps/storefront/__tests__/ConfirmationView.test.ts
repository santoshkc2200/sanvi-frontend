import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { initI18n } from '@sanvi/i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetConversionTrackerForTesting } from '../src/lib/checkout/conversion'
import ConfirmationView from '../src/lib/checkout/ConfirmationView.svelte'
import type { CheckoutView, OrderItem } from '../src/lib/checkout/types'

describe('ConfirmationView component', () => {
  initI18n({ locale: 'en' })

  beforeEach(() => {
    resetConversionTrackerForTesting()
  })

  const paidCheckout: CheckoutView = {
    id: 'chk_done',
    amount_minor: 2000,
    currency: 'JPY',
    reference: 'ord-2026-001',
    status: 'paid',
    conversion_event_id: 'conv_evt_999',
    created_at: new Date().toISOString(),
  }

  const sampleItems: OrderItem[] = [
    {
      id: 'it-1',
      name: 'Design System Course',
      quantity: 1,
      amount_minor: 2000,
      description: 'Lifetime access',
    },
  ]

  it('renders order confirmation details, receipt note, next steps, and return link', () => {
    render(ConfirmationView, {
      props: {
        checkout: paidCheckout,
        items: sampleItems,
      },
    })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment confirmed')
    expect(screen.getByText('Thank you for your order!')).toBeInTheDocument()
    expect(screen.getByText('Order reference: ord-2026-001')).toBeInTheDocument()
    expect(screen.getByText('Design System Course')).toBeInTheDocument()
    expect(screen.getByText('A receipt has been sent to your email address.')).toBeInTheDocument()
    expect(screen.getByText('Next steps')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to store' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to store' })).toHaveAttribute('href', '/')
  })

  it('formats JPY with no decimals in confirmation total', () => {
    render(ConfirmationView, {
      props: {
        checkout: paidCheckout,
        items: sampleItems,
      },
    })

    const amounts = screen.getAllByText(/2,000/)
    expect(amounts.length).toBeGreaterThan(0)
    for (const el of amounts) {
      expect(el.textContent).not.toContain('.00')
    }
  })

  it('reports conversion event upon rendering', async () => {
    const onConversionReported = vi.fn()
    render(ConfirmationView, {
      props: {
        checkout: paidCheckout,
        items: sampleItems,
        onConversionReported,
      },
    })

    // Svelte 5 $effect runs on microtask flush
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onConversionReported).toHaveBeenCalledWith('conv_evt_999')
  })

  it('renders server-backed summary without line items when items are omitted (Defect 8)', () => {
    render(ConfirmationView, {
      props: {
        checkout: paidCheckout,
      },
    })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment confirmed')
    expect(screen.getByText('Amount paid')).toBeInTheDocument()
    expect(screen.queryByText('Design System Course')).not.toBeInTheDocument()
  })

  it('omits line items when client items do not reconcile with checkout amount (Defect 8)', () => {
    const mismatchingItems: OrderItem[] = [
      {
        id: 'it-diff',
        name: 'Unrelated Course',
        quantity: 1,
        amount_minor: 9999,
      },
    ]

    render(ConfirmationView, {
      props: {
        checkout: paidCheckout,
        items: mismatchingItems,
      },
    })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment confirmed')
    expect(screen.getByText('Amount paid')).toBeInTheDocument()
    expect(screen.queryByText('Unrelated Course')).not.toBeInTheDocument()
  })

  it('passes axe accessibility checks', async () => {
    const { container } = render(ConfirmationView, {
      props: {
        checkout: paidCheckout,
        items: sampleItems,
      },
    })

    expect(await axe(container)).toHaveNoViolations()
  })
})
