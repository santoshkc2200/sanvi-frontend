import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import PastDueBanner from '../src/PastDueBanner.svelte'

describe('PastDueBanner', () => {
  it('renders title and grace period days remaining', () => {
    render(PastDueBanner, { props: { daysRemaining: 3, portalHref: '/billing' } })
    expect(screen.getByText('Payment past due:')).toBeInTheDocument()
    expect(screen.getByText(/You have 3 days remaining in your grace period/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Update payment method' })).toHaveAttribute(
      'href',
      '/billing',
    )
  })

  it('renders default message when no daysRemaining is provided', () => {
    render(PastDueBanner, { props: {} })
    expect(
      screen.getByText(/Please update your payment method to keep your subscription active/),
    ).toBeInTheDocument()
  })

  it('calls onUpdatePayment callback when provided', async () => {
    const onUpdatePayment = vi.fn()
    render(PastDueBanner, { props: { onUpdatePayment } })

    const button = screen.getByRole('button', { name: 'Update payment method' })
    await fireEvent.click(button)
    expect(onUpdatePayment).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(PastDueBanner, { props: { daysRemaining: 2 } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
