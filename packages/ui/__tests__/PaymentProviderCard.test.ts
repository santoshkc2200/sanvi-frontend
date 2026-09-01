import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import PaymentProviderCard from '../src/PaymentProviderCard.svelte'

const STRIPE_PROVIDER = {
  kind: 'stripe_connect',
  display_name: 'Stripe',
  available: true,
  requires_onboarding: true,
  supported_countries: ['US', 'JP', 'GB', 'DE'],
}

const UNAVAILABLE_PROVIDER = {
  kind: 'stripe_connect',
  display_name: 'Stripe',
  available: false,
  requires_onboarding: true,
  supported_countries: ['US', 'JP'],
}

describe('PaymentProviderCard', () => {
  it('renders display name and connect CTA when available and entitled', async () => {
    const onConnect = vi.fn()
    render(PaymentProviderCard, {
      props: {
        provider: STRIPE_PROVIDER,
        entitled: true,
        onConnect,
      },
    })

    expect(screen.getByText('Stripe')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Connect' })
    expect(button).toBeInTheDocument()

    await fireEvent.click(button)
    expect(onConnect).toHaveBeenCalledWith(STRIPE_PROVIDER)
  })

  it('renders unavailable state instead of dead connect button', () => {
    const onConnect = vi.fn()
    render(PaymentProviderCard, {
      props: {
        provider: UNAVAILABLE_PROVIDER,
        entitled: true,
        onConnect,
      },
    })

    expect(screen.getByText('Stripe')).toBeInTheDocument()
    expect(screen.getByText('Unavailable in your region')).toBeInTheDocument()
    expect(screen.getByText('This provider is not available in your country.')).toBeInTheDocument()
    expect(screen.getByText(/Supported countries: US, JP/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('replaces CTA with UpgradePrompt when not entitled', () => {
    render(PaymentProviderCard, {
      props: {
        provider: STRIPE_PROVIDER,
        entitled: false,
        upgradeHref: '/billing',
      },
    })

    expect(screen.getByText('Stripe')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
    expect(screen.getByText('Upgrade required')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View plans & upgrade' })).toHaveAttribute(
      'href',
      '/billing',
    )
  })

  it('renders synthetic provider kind without code change', () => {
    const synthetic = {
      kind: 'synthetic_paypal',
      display_name: 'Synthetic PayPal',
      available: true,
      requires_onboarding: true,
      supported_countries: ['US'],
    }
    render(PaymentProviderCard, {
      props: {
        provider: synthetic,
        entitled: true,
      },
    })

    expect(screen.getByText('Synthetic PayPal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument()
  })

  it('uses custom labels when provided', () => {
    render(PaymentProviderCard, {
      props: {
        provider: STRIPE_PROVIDER,
        entitled: true,
        labels: {
          connectCta: 'Custom Connect',
        },
      },
    })
    expect(screen.getByRole('button', { name: 'Custom Connect' })).toBeInTheDocument()
  })

  it('renders an inert connect CTA described by its reason when connectDisabled is true', async () => {
    const onConnect = vi.fn()
    render(PaymentProviderCard, {
      props: {
        provider: STRIPE_PROVIDER,
        entitled: true,
        connectDisabled: true,
        connectDisabledReason: 'Custom disabled reason',
        onConnect,
      },
    })

    const button = screen.getByRole('button', { name: 'Connect' })
    // aria-disabled, not the native attribute: the button must stay focusable so a
    // keyboard user reaches it and hears the reason.
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()

    const reason = screen.getByText('Custom disabled reason')
    expect(button).toHaveAttribute('aria-describedby', reason.id)
    expect(reason.id).not.toBe('')

    await fireEvent.click(button)
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('renders default disabled reason when connectDisabled is true and no reason prop is passed', () => {
    render(PaymentProviderCard, {
      props: {
        provider: STRIPE_PROVIDER,
        entitled: true,
        connectDisabled: true,
      },
    })

    const button = screen.getByRole('button', { name: 'Connect' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Connecting is not available yet.')).toBeInTheDocument()
  })

  it('has no accessibility violations when disabled', async () => {
    const { container } = render(PaymentProviderCard, {
      props: { provider: STRIPE_PROVIDER, entitled: true, connectDisabled: true },
    })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no accessibility violations when available', async () => {
    const { container } = render(PaymentProviderCard, {
      props: { provider: STRIPE_PROVIDER, entitled: true },
    })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no accessibility violations when unavailable', async () => {
    const { container } = render(PaymentProviderCard, {
      props: { provider: UNAVAILABLE_PROVIDER, entitled: true },
    })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no accessibility violations when unentitled', async () => {
    const { container } = render(PaymentProviderCard, {
      props: { provider: STRIPE_PROVIDER, entitled: false },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
