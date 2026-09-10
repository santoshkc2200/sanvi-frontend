import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import CapProgress from '../src/advertising/CapProgress.svelte'

function baseProps() {
  return {
    heading: 'Acme Main Ad Account',
    periodLabel: 'Monthly',
    spendText: '¥40,000 of ¥50,000',
    percentText: '80%',
    freshnessText: 'Spend figures as of 2026-09-10 09:00 (Asia/Tokyo); recent days still update.',
    status: 'warning' as const,
    statusLabel: '80% — approaching cap',
    ratio: 0.8,
    projectedText: '¥52,000',
    projectedLabel: 'Projected at the current run rate',
    actionText: 'Pause this campaign',
    actionLabel: 'At 100%',
  }
}

describe('CapProgress', () => {
  it('renders the spend figure, the percentage, and the status as text — never colour alone', () => {
    render(CapProgress, { props: baseProps() })
    expect(screen.getByText('¥40,000 of ¥50,000')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('80% — approaching cap')).toBeInTheDocument()
  })

  it('always renders the freshness sentence', () => {
    render(CapProgress, { props: baseProps() })
    expect(screen.getByText(/recent days still update/)).toBeInTheDocument()
  })

  it('renders the projected figure and the configured threshold action', () => {
    render(CapProgress, { props: baseProps() })
    expect(screen.getByText('¥52,000')).toBeInTheDocument()
    expect(screen.getByText('Pause this campaign')).toBeInTheDocument()
  })

  it('exposes a progressbar whose value text carries the status', () => {
    render(CapProgress, { props: baseProps() })
    const bar = screen.getByRole('progressbar', { name: 'Acme Main Ad Account' })
    expect(bar).toHaveAttribute('aria-valuenow', '80')
    expect(bar).toHaveAttribute('aria-valuetext', '80% — approaching cap')
  })

  it('renders the 100% state distinctly as text, not only by hue', () => {
    render(CapProgress, {
      props: { ...baseProps(), status: 'hit', statusLabel: 'Cap reached', ratio: 1 },
    })
    expect(screen.getByText('Cap reached')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(CapProgress, { props: baseProps() })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no accessibility violations in the cap-reached state', async () => {
    const { container } = render(CapProgress, {
      props: { ...baseProps(), status: 'hit', statusLabel: 'Cap reached', ratio: 1 },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
