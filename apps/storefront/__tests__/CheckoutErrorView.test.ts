import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { initI18n } from '@sanvi/i18n'
import { describe, expect, it } from 'vitest'
import CheckoutErrorView from '../src/lib/checkout/CheckoutErrorView.svelte'

describe('CheckoutErrorView component', () => {
  initI18n({ locale: 'en' })

  it('renders specific card decline message and try again button', () => {
    render(CheckoutErrorView, { props: { declineCode: 'card_declined' } })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment failed')
    expect(
      screen.getByText('Your card was declined — please try another payment method.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/checkout')
  })

  it('renders specific expired session message', () => {
    render(CheckoutErrorView, { props: { declineCode: 'expired' } })

    expect(
      screen.getByText('The payment session has expired — please start again.'),
    ).toBeInTheDocument()
  })

  it('renders specific cannot accept payments message', () => {
    render(CheckoutErrorView, { props: { declineCode: 'cannot_accept_payments' } })

    expect(
      screen.getByText('This store cannot accept payments right now. Please try again later.'),
    ).toBeInTheDocument()
  })

  it('passes axe accessibility checks', async () => {
    const { container } = render(CheckoutErrorView, { props: { declineCode: 'card_declined' } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
