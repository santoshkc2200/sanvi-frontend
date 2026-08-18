import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import UsageMeter from '../src/UsageMeter.svelte'

describe('UsageMeter', () => {
  it('renders used/limit as text and as a progressbar', () => {
    render(UsageMeter, { props: { label: 'API calls', used: 400, limit: 1000 } })
    expect(screen.getByText('400 / 1,000')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: 'API calls' })
    expect(bar).toHaveAttribute('aria-valuenow', '400')
    expect(bar).toHaveAttribute('aria-valuemax', '1000')
  })

  it('renders without a bar when unlimited', () => {
    render(UsageMeter, { props: { label: 'Storage', used: 12, limit: null, unit: 'GB' } })
    expect(screen.getByText('12 GB')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('crosses into the warning and critical thresholds', () => {
    const { container: warning } = render(UsageMeter, {
      props: { label: 'Seats', used: 85, limit: 100 },
    })
    expect(warning.querySelector('.sanvi-usage-meter__fill--warning')).toBeInTheDocument()

    const { container: critical } = render(UsageMeter, {
      props: { label: 'Seats', used: 99, limit: 100 },
    })
    expect(critical.querySelector('.sanvi-usage-meter__fill--critical')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(UsageMeter, {
      props: { label: 'API calls', used: 400, limit: 1000 },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
