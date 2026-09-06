import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AdDriftDiff from '../src/advertising/AdDriftDiff.svelte'

const ROWS = [
  { field: 'Name', ours: 'Summer sale', theirs: 'Summer SUPER sale' },
  { field: 'Budget', ours: '¥1,000 (Daily budget)', theirs: '¥5,000 (Daily budget)' },
]

describe('AdDriftDiff', () => {
  it('renders one row per changed field with both versions', () => {
    render(AdDriftDiff, { rows: ROWS })
    expect(screen.getByText('Summer sale')).toBeInTheDocument()
    expect(screen.getByText('Summer SUPER sale')).toBeInTheDocument()
    expect(screen.getByText('¥5,000 (Daily budget)')).toBeInTheDocument()
  })

  it('labels the two sides in words, equal weight', () => {
    render(AdDriftDiff, {
      rows: ROWS,
      labels: { oursHeader: 'Ours (Sanvi)', theirsHeader: 'Theirs (platform, current)' },
    })
    expect(screen.getByText('Ours (Sanvi)')).toBeInTheDocument()
    expect(screen.getByText('Theirs (platform, current)')).toBeInTheDocument()
  })

  it('exposes a caption associating the table with its meaning', () => {
    render(AdDriftDiff, {
      rows: ROWS,
      labels: { tableCaption: 'Differences between Sanvi and the ad platform' },
    })
    expect(screen.getByText('Differences between Sanvi and the ad platform')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(AdDriftDiff, { rows: ROWS })
    expect(await axe(container)).toHaveNoViolations()
  })
})
