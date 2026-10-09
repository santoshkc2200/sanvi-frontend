import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import UsageDimensionCard from '../src/UsageDimensionCard.svelte'

const base = {
  name: 'Seats',
  upgradeCtaLabel: 'View plans & upgrade',
  upgradeHref: '/billing',
  warningText: 'Seats has used 4 of 5 (80%).',
  limitReachedText: 'Seats has reached its limit (5 of 5). Usage resets 1 Nov 2026.',
}

describe('UsageDimensionCard', () => {
  it('renders the meter with no state copy or upgrade link under the threshold', () => {
    render(UsageDimensionCard, { props: { ...base, used: 2, limit: 5 } })
    expect(screen.getByRole('heading', { name: 'Seats' })).toBeInTheDocument()
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
    expect(screen.queryByText(/has used 4 of 5/)).not.toBeInTheDocument()
    expect(screen.queryByText(/has reached its limit/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'View plans & upgrade' })).not.toBeInTheDocument()
  })

  it('renders the warning state with the upgrade path at the threshold', () => {
    render(UsageDimensionCard, { props: { ...base, used: 4, limit: 5 } })
    expect(screen.getByText('Seats has used 4 of 5 (80%).')).toBeInTheDocument()
    expect(screen.queryByText(/has reached its limit/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View plans & upgrade' })).toHaveAttribute(
      'href',
      '/billing',
    )
  })

  it('renders the dimension-specific limit-reached state at the wall', () => {
    render(UsageDimensionCard, { props: { ...base, used: 5, limit: 5 } })
    expect(
      screen.getByText('Seats has reached its limit (5 of 5). Usage resets 1 Nov 2026.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/has used 4 of 5/)).not.toBeInTheDocument()
  })

  it('renders no upgrade link when the caller supplies no CTA', () => {
    const { upgradeCtaLabel: _cta, upgradeHref: _href, ...noCta } = base
    render(UsageDimensionCard, { props: { ...noCta, used: 5, limit: 5 } })
    expect(screen.getByText(/has reached its limit/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('has no accessibility violations in the limit-reached state', async () => {
    const { container } = render(UsageDimensionCard, {
      props: { ...base, used: 6, limit: 5 },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
