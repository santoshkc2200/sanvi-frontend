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

  it('has no accessibility violations', async () => {
    const { container } = render(AuditTrail, { props: { entries: ENTRIES } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
