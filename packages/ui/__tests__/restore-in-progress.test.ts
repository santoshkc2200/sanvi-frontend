import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import RestoreInProgress from '../src/RestoreInProgress.svelte'

describe('RestoreInProgress (TASK-025 step 5)', () => {
  it('renders the honest restore state with the restore marker — never an empty dataset', () => {
    render(RestoreInProgress, {
      props: {
        title: 'Workspace restore in progress',
        description: 'Your workspace data is being restored.',
      },
    })
    const state = screen.getByRole('status')
    expect(state).toHaveTextContent('Workspace restore in progress')
    expect(state).toHaveTextContent('being restored')
    expect(state).toHaveAttribute('data-restore', 'in-progress')
  })

  it('links to the status page when a status href is given', () => {
    render(RestoreInProgress, {
      props: {
        title: 'Workspace restore in progress',
        description: 'Restoring.',
        statusHref: '/status',
        statusLinkLabel: 'View status page',
      },
    })
    expect(screen.getByRole('link', { name: 'View status page' })).toHaveAttribute(
      'href',
      '/status',
    )
  })

  it('has no accessibility violations', async () => {
    const { container } = render(RestoreInProgress, {
      props: { title: 'Workspace restore in progress', description: 'Restoring.' },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
