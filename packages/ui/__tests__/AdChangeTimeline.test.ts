import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AdChangeTimeline from '../src/advertising/AdChangeTimeline.svelte'

const ITEMS = [
  {
    id: 'c2',
    heading: 'Jane changed this campaign in Sanvi',
    meta: 'Sep 2, 2026, 3:04 PM',
    source: { label: 'From Sanvi', variant: 'info' as const },
    fields: ['Status'],
    details: [{ field: 'Status', before: 'Active', after: 'Paused' }],
  },
  {
    id: 'c1',
    heading: 'Google Ads changed this campaign in its own tool',
    meta: 'Sep 1, 2026, 9:00 AM',
    source: { label: 'Changed outside Sanvi', variant: 'warning' as const },
    fields: ['Budget'],
  },
]

describe('AdChangeTimeline', () => {
  it('renders the change log as readable history', () => {
    render(AdChangeTimeline, { items: ITEMS })
    expect(screen.getByText('Jane changed this campaign in Sanvi')).toBeInTheDocument()
    expect(screen.getByText('Google Ads changed this campaign in its own tool')).toBeInTheDocument()
    expect(screen.getByText('Sep 2, 2026, 3:04 PM')).toBeInTheDocument()
  })

  it('shows before → after values with screen-reader labels', () => {
    render(AdChangeTimeline, { items: ITEMS })
    // The arrow is visible; "Before"/"After" are announced to screen readers.
    expect(screen.getByText(/Active/)).toBeInTheDocument()
    expect(screen.getByText('Before:')).toBeInTheDocument()
    expect(screen.getByText('After:')).toBeInTheDocument()
  })

  it('attributes platform-sourced changes with a badge', () => {
    render(AdChangeTimeline, { items: ITEMS })
    expect(screen.getByText('Changed outside Sanvi')).toBeInTheDocument()
    expect(screen.getByText('From Sanvi')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(AdChangeTimeline, { items: ITEMS })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders an empty timeline without crashing', async () => {
    const { container } = render(AdChangeTimeline, { items: [] })
    expect(await axe(container)).toHaveNoViolations()
  })
})
