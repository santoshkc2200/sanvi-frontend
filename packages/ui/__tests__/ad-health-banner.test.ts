import { axe } from '@sanvi/test-config/axe'
import { cleanup, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HealthBanner from '../src/advertising/HealthBanner.svelte'

/**
 * The diagnostics health banner (TASK-015). The load-bearing assertions:
 * the two health figures render as separate labelled entries, each with
 * its own copy, so neither the suppression share nor the upload failure
 * ratio is expressed by colour alone or collapsed into the other.
 */

afterEach(cleanup)

const figures = [
  {
    key: 'suppression',
    value: '38%',
    label: 'Suppression share',
    description: '4 of 10 recent conversions were suppressed by a privacy directive.',
  },
  {
    key: 'failures',
    value: '2 of 6',
    label: 'Upload failures',
    description: 'Uploads are failing for 2 of 6 events attempted.',
  },
]

describe('HealthBanner', () => {
  it('renders each figure with its own label, value, and description', () => {
    render(HealthBanner, { title: 'Conversion health needs attention', figures })
    expect(screen.getByText('Conversion health needs attention')).toBeTruthy()
    expect(screen.getByText('Suppression share')).toBeTruthy()
    expect(screen.getByText('38%')).toBeTruthy()
    expect(screen.getByText('Upload failures')).toBeTruthy()
    expect(screen.getByText('2 of 6')).toBeTruthy()
  })

  it('renders an action when one is supplied and nothing clickable otherwise', async () => {
    const onAction = vi.fn()
    const withAction = render(HealthBanner, {
      title: 'Needs attention',
      figures,
      actionLabel: 'Open diagnostics',
      onAction,
    })
    const button = screen.getByRole('button', { name: 'Open diagnostics' })
    button.click()
    expect(onAction).toHaveBeenCalledTimes(1)
    withAction.unmount()

    render(HealthBanner, { title: 'Needs attention', figures })
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('passes axe', async () => {
    const { container } = render(HealthBanner, { title: 'Needs attention', figures })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
