import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import StatusBanner from '../src/StatusBanner.svelte'

const MAINTENANCE = {
  kind: 'maintenance' as const,
  title: 'Service notice',
  description: 'Affected: redis.',
  dismissLabel: 'Dismiss',
}

const DEGRADED = {
  kind: 'degraded' as const,
  title: 'Service is degraded',
  description: 'Affected: redis, database.',
  dismissLabel: 'Dismiss',
}

describe('StatusBanner (TASK-025 step 4)', () => {
  it('renders an informational maintenance banner as a polite status with the maintenance marker', () => {
    render(StatusBanner, { props: MAINTENANCE })
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Service notice')
    expect(banner).toHaveTextContent('Affected: redis.')
    expect(banner).toHaveAttribute('data-system-banner', 'maintenance')
  })

  it('an informational banner is dismissible', async () => {
    render(StatusBanner, { props: MAINTENANCE })
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('a new maintenance signal un-dismisses the banner', async () => {
    const view = render(StatusBanner, { props: MAINTENANCE })
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await view.rerender({ ...MAINTENANCE, description: 'Affected: database.' })
    expect(screen.getByRole('status')).toHaveTextContent('Affected: database.')
  })

  it('renders a blocking degraded banner as an alert with the degraded marker', () => {
    render(StatusBanner, { props: DEGRADED })
    const banner = screen.getByRole('alert')
    expect(banner).toHaveTextContent('Service is degraded')
    expect(banner).toHaveAttribute('data-system-banner', 'degraded')
  })

  it('a blocking banner is not dismissible — no dismiss control renders', () => {
    render(StatusBanner, { props: DEGRADED })
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('links to the status page when a status href is given', () => {
    render(StatusBanner, {
      props: { ...DEGRADED, statusHref: '/status', statusLinkLabel: 'View status page' },
    })
    expect(screen.getByRole('link', { name: 'View status page' })).toHaveAttribute(
      'href',
      '/status',
    )
  })

  it('has no accessibility violations in either kind', async () => {
    const maintenance = render(StatusBanner, { props: MAINTENANCE })
    expect(await axe(maintenance.container)).toHaveNoViolations()
    maintenance.unmount()
    const degraded = render(StatusBanner, {
      props: { ...DEGRADED, statusHref: '/status', statusLinkLabel: 'View status page' },
    })
    expect(await axe(degraded.container)).toHaveNoViolations()
  })
})
