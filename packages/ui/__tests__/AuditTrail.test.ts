import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AuditTrail, { type AuditEntryRow } from '../src/AuditTrail.svelte'

const ENTRIES: AuditEntryRow[] = [
  {
    id: '1',
    occurredAt: '2026-08-18T10:00:00Z',
    actorLabel: 'alice@example.com',
    action: 'entitlement.granted',
    resourceLabel: 'advertising.google_ads',
    before: { enabled: false },
    after: { enabled: true },
  },
]

describe('AuditTrail', () => {
  it('shows a loading state', () => {
    render(AuditTrail, { props: { entries: [], loading: true, loadingLabel: 'Loading log' } })
    expect(screen.getByText('Loading log')).toBeInTheDocument()
  })

  it('shows an empty state when there are no entries', () => {
    render(AuditTrail, { props: { entries: [], emptyMessage: 'No activity yet.' } })
    expect(screen.getByText('No activity yet.')).toBeInTheDocument()
  })

  it('renders each entry with actor, action, and resource', () => {
    render(AuditTrail, { props: { entries: ENTRIES } })
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('entitlement.granted')).toBeInTheDocument()
    expect(screen.getByText('advertising.google_ads')).toBeInTheDocument()
  })

  it('expands a before/after diff on demand', async () => {
    render(AuditTrail, { props: { entries: ENTRIES } })
    expect(screen.queryByText('false')).not.toBeInTheDocument()

    await fireEvent.click(screen.getByText('View changes'))

    expect(screen.getByText('enabled')).toBeInTheDocument()
    expect(screen.getByText('false')).toBeInTheDocument()
    expect(screen.getByText('true')).toBeInTheDocument()
  })

  it('does not flag nullish pairs or reordered object keys as changes', async () => {
    render(AuditTrail, {
      props: {
        entries: [
          {
            id: '2',
            occurredAt: '2026-08-18T10:00:00Z',
            actorLabel: 'system',
            action: 'settings.updated',
            before: { a: 1, b: null },
            after: { b: undefined, a: 1 },
          },
        ],
      },
    })
    await fireEvent.click(screen.getByText('View changes'))

    const row = screen.getByText('a').closest('tr')
    expect(row).not.toHaveClass('sanvi-audit-trail__diff-row--changed')
    // Both nullish values render the same "—" placeholder.
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('shows a human-readable time while keeping the ISO value on the datetime attribute', () => {
    render(AuditTrail, { props: { entries: ENTRIES } })
    const time = screen.getByText('alice@example.com').parentElement?.querySelector('time')
    expect(time).toHaveAttribute('datetime', '2026-08-18T10:00:00Z')
    // The raw ISO string must not be what operators read.
    expect(time?.textContent).not.toBe('2026-08-18T10:00:00Z')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(AuditTrail, { props: { entries: ENTRIES } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
