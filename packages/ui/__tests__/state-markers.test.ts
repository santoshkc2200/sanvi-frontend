import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Alert from '../src/Alert.svelte'
import EmptyState from '../src/EmptyState.svelte'
import ErrorView from '../src/ErrorView.svelte'
import Spinner from '../src/Spinner.svelte'
import { createRawSnippet } from 'svelte'

/**
 * The `data-async-state` markers are the contract the per-route outage e2e
 * (TASK-023 step 5) asserts against: a route that has been given a failure
 * long enough to time out must show *some* terminal state — `error`, `empty`
 * — and no `loading` marker may survive its bound. The markers live on the
 * shared primitives so every surface that composes them inherits the
 * contract instead of hand-rolling its own.
 */
describe('async-state markers (TASK-023 step 5)', () => {
  it('Spinner marks loading', () => {
    render(Spinner, { props: { label: 'Loading' } })
    expect(screen.getByRole('status')).toHaveAttribute('data-async-state', 'loading')
  })

  it('EmptyState marks empty', () => {
    render(EmptyState, { props: { title: 'No rows' } })
    expect(screen.getByText('No rows').closest('[data-async-state]')).toHaveAttribute(
      'data-async-state',
      'empty',
    )
  })

  it('ErrorView marks error', () => {
    const { container } = render(ErrorView, { props: { title: 'Failed', description: 'd' } })
    // Closest() would find the inner EmptyState's own marker — assert the
    // error marker wraps the view's content.
    expect(container.querySelector('[data-async-state="error"]')).toHaveTextContent('Failed')
  })

  it('Alert marks only its error variant as a terminal error state', () => {
    const body = createRawSnippet(() => ({ render: () => '<p>body</p>' }))
    const { container, rerender } = render(Alert, {
      props: { variant: 'error', children: body },
    })
    expect(container.querySelector('[data-async-state="error"]')).not.toBeNull()
    // @ts-expect-error testing-library rerender props typing
    rerender({ props: { variant: 'info', children: body } })
    expect(container.querySelector('[data-async-state]')).toBeNull()
  })
})
