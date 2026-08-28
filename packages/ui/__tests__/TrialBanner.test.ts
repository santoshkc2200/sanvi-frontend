import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import TrialBanner from '../src/TrialBanner.svelte'

describe('TrialBanner', () => {
  it('renders countdown days and trial end date', () => {
    render(TrialBanner, { props: { daysRemaining: 5, trialEnd: '2026-09-02' } })
    expect(screen.getByText(/5 days left in your free trial/)).toBeInTheDocument()
    expect(screen.getByText(/\(ends 2026-09-02\)/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Upgrade now' })).toHaveAttribute('href', '/billing')
  })

  it('renders singular day when 1 day remains and sets urgent styling', () => {
    const { container } = render(TrialBanner, { props: { daysRemaining: 1 } })
    expect(screen.getByText(/1 day left in your free trial/)).toBeInTheDocument()
    expect(container.querySelector('.sanvi-trial-banner--urgent')).toBeInTheDocument()
  })

  it('calls onSubscribe callback when provided', async () => {
    const onSubscribe = vi.fn()
    render(TrialBanner, { props: { daysRemaining: 3, onSubscribe } })

    const button = screen.getByRole('button', { name: 'Upgrade now' })
    await fireEvent.click(button)
    expect(onSubscribe).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(TrialBanner, {
      props: { daysRemaining: 4, trialEnd: '2026-09-01' },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
