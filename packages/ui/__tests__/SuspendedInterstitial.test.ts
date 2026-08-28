import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import SuspendedInterstitial from '../src/SuspendedInterstitial.svelte'

describe('SuspendedInterstitial', () => {
  it('renders title, explanation, portal button, and support link', () => {
    render(SuspendedInterstitial, {
      props: { reason: 'billing', portalHref: '/billing', supportHref: 'mailto:help@example.com' },
    })
    expect(screen.getByText('Workspace suspended')).toBeInTheDocument()
    expect(screen.getByText('Reason: billing')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Manage billing & reactivate' })).toHaveAttribute(
      'href',
      '/billing',
    )
    expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute(
      'href',
      'mailto:help@example.com',
    )
  })

  it('calls onOpenPortal callback when provided', async () => {
    const onOpenPortal = vi.fn()
    render(SuspendedInterstitial, { props: { onOpenPortal } })

    const button = screen.getByRole('button', { name: 'Manage billing & reactivate' })
    await fireEvent.click(button)
    expect(onOpenPortal).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(SuspendedInterstitial, {
      props: { reason: 'billing', portalHref: '/billing' },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
