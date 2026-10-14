import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import EmptyState from '../src/EmptyState.svelte'

describe('EmptyState (default variant)', () => {
  it('renders title, description, and the empty marker', () => {
    render(EmptyState, { props: { title: 'No members yet', description: 'Invite someone.' } })
    const state = screen.getByText('No members yet').closest('[data-async-state]')
    expect(state).toHaveAttribute('data-async-state', 'empty')
    expect(state).not.toHaveAttribute('data-archived')
    expect(screen.getByText('Invite someone.')).toBeInTheDocument()
  })
})

describe('EmptyState archived-range variant (TASK-028)', () => {
  it('renders the archived marker on the same empty state — a variant, not a new component', () => {
    const { container } = render(EmptyState, {
      props: {
        title: 'This window is archived',
        description: 'The requested period is in cold storage.',
        variant: 'archived',
      },
    })
    const state = container.querySelector('[data-async-state="empty"]')
    expect(state).not.toBeNull()
    expect(state).toHaveAttribute('data-archived', 'range')
  })

  it('names the restore path with a link when given one', () => {
    render(EmptyState, {
      props: {
        title: 'This window is archived',
        variant: 'archived',
        restoreHref: 'https://docs.example.test/runbooks/archival',
        restoreLinkLabel: 'How to restore archived data',
      },
    })
    const link = screen.getByRole('link', { name: 'How to restore archived data' })
    expect(link).toHaveAttribute('href', 'https://docs.example.test/runbooks/archival')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('renders no restore link when none is given', () => {
    render(EmptyState, {
      props: { title: 'This window is archived', variant: 'archived' },
    })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('still honors a custom action snippet alongside the variant', () => {
    render(EmptyState, {
      props: { title: 'This window is archived', variant: 'archived' },
    })
    // no action passed — root stays clean of empty action containers
    expect(screen.queryByText('How to restore archived data')).not.toBeInTheDocument()
  })

  it('has no accessibility violations in the archived variant', async () => {
    const { container } = render(EmptyState, {
      props: {
        title: 'This window is archived',
        description: 'The requested period is in cold storage.',
        variant: 'archived',
        restoreHref: 'https://docs.example.test/runbooks/archival',
        restoreLinkLabel: 'How to restore archived data',
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
