import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ErrorView from '../src/ErrorView.svelte'

describe('ErrorView', () => {
  it('renders the generic error title and description', () => {
    render(ErrorView, { props: { title: 'Something went wrong', description: 'Try again.' } })
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Try again.')).toBeInTheDocument()
  })

  it('renders a retry action and calls onRetry when clicked', async () => {
    const onRetry = vi.fn()
    render(ErrorView, {
      props: { title: 'Something went wrong', retryLabel: 'Try again', onRetry },
    })

    screen.getByRole('button', { name: 'Try again' }).click()
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows the trace id for the generic branch', () => {
    render(ErrorView, { props: { title: 'Error', traceId: 'trace-abc' } })
    expect(screen.getByText('Reference: trace-abc')).toBeInTheDocument()
  })

  it('delegates to the suspended-tenant view when a reason is set, instead of the generic error', () => {
    render(ErrorView, { props: { title: 'ignored', reason: 'suspended', billingHref: '/billing' } })

    expect(screen.getByText(/suspended/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to billing' })).toBeInTheDocument()
  })

  it('has no accessibility violations — generic branch', async () => {
    const { container } = render(ErrorView, {
      props: { title: 'Error', retryLabel: 'Try again', onRetry: vi.fn() },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
