import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import UpgradePrompt from '../src/UpgradePrompt.svelte'

describe('UpgradePrompt', () => {
  it('renders default title and contextual description with feature name', () => {
    render(UpgradePrompt, { props: { feature: 'domains.custom', upgradeHref: '/billing' } })
    expect(screen.getByText('Upgrade to unlock this feature')).toBeInTheDocument()
    expect(
      screen.getByText(/The "domains.custom" feature is available on a higher plan tier/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View plans & upgrade' })).toHaveAttribute(
      'href',
      '/billing',
    )
  })

  it('renders custom title, description, and cta', () => {
    render(UpgradePrompt, {
      props: {
        title: 'Custom Title',
        description: 'Custom Description',
        ctaLabel: 'Unlock Now',
        upgradeHref: '/custom-upgrade',
      },
    })
    expect(screen.getByText('Custom Title')).toBeInTheDocument()
    expect(screen.getByText('Custom Description')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Unlock Now' })).toHaveAttribute(
      'href',
      '/custom-upgrade',
    )
  })

  it('calls onUpgrade callback when provided', async () => {
    const onUpgrade = vi.fn()
    render(UpgradePrompt, { props: { feature: 'sso.saml', onUpgrade } })

    const button = screen.getByRole('button', { name: 'View plans & upgrade' })
    await fireEvent.click(button)
    expect(onUpgrade).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(UpgradePrompt, {
      props: { feature: 'domains.custom', upgradeHref: '/billing' },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
