import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import AsyncBoundary from '../src/errors/AsyncBoundary.svelte'
import BoundaryHost from './fixtures/BoundaryHost.svelte'

describe('AsyncBoundary (TASK-023 step 3)', () => {
  it('contains a panel failure: the failed view renders, the shell around it survives', () => {
    render(BoundaryHost)

    // The child threw during render — the boundary's failed view stands in…
    expect(screen.getByText('Panel failed')).toBeInTheDocument()
    // …and the app around the panel is untouched (never a full-app crash
    // from one panel).
    expect(screen.getByTestId('outside')).toHaveTextContent('shell around the panel')
  })

  it('shows the recovery action and the trace id on the failed view', () => {
    render(BoundaryHost)

    expect(screen.getByRole('button', { name: 'Try this panel again' })).toBeInTheDocument()
    expect(screen.getByText('Reference: abc123')).toBeInTheDocument()
  })

  it('retry resets the boundary and re-renders the panel once the caller fixes it', async () => {
    render(BoundaryHost)

    await fireEvent.click(screen.getByRole('button', { name: 'Try this panel again' }))
    // onRetry flipped the fixture's `crashes` off; reset re-rendered the
    // children, so the panel content is back.
    await vi.waitFor(() => {
      expect(screen.getByTestId('boundary-child-ok')).toHaveTextContent('panel content')
    })
  })

  it('renders children directly when nothing throws', () => {
    render(AsyncBoundary, {
      props: {
        title: 'Unused',
        children: createRawSnippet(() => ({
          render: () => '<p data-testid="happy">all fine</p>',
        })),
      },
    })
    expect(screen.getByTestId('happy')).toHaveTextContent('all fine')
    expect(screen.queryByText('Unused')).not.toBeInTheDocument()
  })

  it('reports the error through onError and passes no a11y violations on the failed view', async () => {
    const onError = vi.fn()
    const { container } = render(AsyncBoundary, {
      props: {
        title: 'Broken',
        retryLabel: 'Retry',
        onError,
        children: createRawSnippet(() => {
          throw new Error('boom')
        }),
      },
    })
    expect(onError).toHaveBeenCalled()
    expect(await axe(container)).toHaveNoViolations()
  })
})
