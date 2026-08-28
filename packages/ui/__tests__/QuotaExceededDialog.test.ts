import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import QuotaExceededDialog from '../src/QuotaExceededDialog.svelte'

describe('QuotaExceededDialog', () => {
  it('renders when open with usage and limit description', () => {
    render(QuotaExceededDialog, {
      props: {
        open: true,
        feature: 'team members',
        currentUsage: 5,
        limit: 5,
        upgradeHref: '/billing',
      },
    })
    expect(screen.getByText('Plan limit reached')).toBeInTheDocument()
    expect(
      screen.getByText(
        'You have reached your limit of 5/5 for team members. Upgrade your plan to increase this limit.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Upgrade plan' })).toHaveAttribute('href', '/billing')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('invokes onClose when cancel is clicked', async () => {
    const onClose = vi.fn()
    render(QuotaExceededDialog, {
      props: { open: true, feature: 'storage', onClose },
    })

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    await fireEvent.click(cancelButton)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('invokes onUpgrade when upgrade button is clicked', async () => {
    const onUpgrade = vi.fn()
    render(QuotaExceededDialog, {
      props: { open: true, feature: 'storage', onUpgrade },
    })

    const upgradeButton = screen.getByRole('button', { name: 'Upgrade plan' })
    await fireEvent.click(upgradeButton)
    expect(onUpgrade).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(QuotaExceededDialog, {
      props: { open: true, feature: 'team members', currentUsage: 10, limit: 10 },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
