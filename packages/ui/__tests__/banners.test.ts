import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import OfflineBanner from '../src/OfflineBanner.svelte'
import StaleContentBanner from '../src/StaleContentBanner.svelte'

describe('OfflineBanner (TASK-023 step 7)', () => {
  it('announces the offline state politely and carries the connectivity marker', () => {
    render(OfflineBanner, {
      props: { title: "You're offline", description: 'Actions need a connection.' },
    })
    expect(screen.getByRole('status')).toHaveTextContent("You're offline")
    expect(screen.getByRole('status')).toHaveTextContent('Actions need a connection.')
    expect(screen.getByRole('status')).toHaveAttribute('data-connectivity', 'offline')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(OfflineBanner, {
      props: { title: "You're offline", description: 'd' },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('StaleContentBanner (TASK-023 step 4 — honesty over reassurance)', () => {
  it('names what is stale instead of rendering degraded content as normal', () => {
    render(StaleContentBanner, {
      props: {
        title: 'Some content may be out of date',
        description: "We're serving a cached copy while our service recovers.",
      },
    })
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Some content may be out of date')
    expect(banner).toHaveTextContent('cached copy')
    expect(banner).toHaveAttribute('data-degraded', 'stale')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(StaleContentBanner, {
      props: { title: 'Stale', description: 'd' },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
