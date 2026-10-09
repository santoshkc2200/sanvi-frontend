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

  it('shows the app-rendered trace line and the copy-diagnostics action when given', () => {
    render(ErrorView, {
      props: {
        title: 'Error',
        traceLine: 'Reference: trace-abc',
        diagnosticsText: 'Sanvi diagnostics\ntrace_id: trace-abc',
        copyLabel: 'Copy diagnostics',
        copiedLabel: 'Copied!',
      },
    })
    expect(screen.getByText('Reference: trace-abc')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy diagnostics' })).toBeInTheDocument()
  })

  it('renders neither trace line nor copy action without diagnostics props', () => {
    render(ErrorView, { props: { title: 'Error' } })
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument()
  })

  it('delegates to the suspended-tenant view when a reason is set, instead of the generic error', () => {
    render(ErrorView, { props: { title: 'ignored', reason: 'suspended', billingHref: '/billing' } })

    expect(screen.getByText(/suspended/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to billing' })).toBeInTheDocument()
  })

  it('links to the status page from the generic error when a status href is given', () => {
    render(ErrorView, {
      props: {
        title: 'Something went wrong',
        retryLabel: 'Try again',
        onRetry: vi.fn(),
        statusHref: 'http://status.example/status',
        statusLinkLabel: 'View system status',
      },
    })

    expect(screen.getByRole('link', { name: 'View system status' })).toHaveAttribute(
      'href',
      'http://status.example/status',
    )
  })

  it('renders the restore state — never an empty dataset — when the reason is restoring', () => {
    render(ErrorView, {
      props: {
        title: 'ignored',
        reason: 'restoring',
        restoreTitle: 'Workspace restore in progress',
        restoreDescription: 'Your workspace data is being restored.',
      },
    })

    const state = document.querySelector('[data-restore="in-progress"]')
    expect(state).toBeInTheDocument()
    expect(state).toHaveTextContent('Workspace restore in progress')
  })

  it('has no accessibility violations — generic branch', async () => {
    const { container } = render(ErrorView, {
      props: { title: 'Error', retryLabel: 'Try again', onRetry: vi.fn() },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
