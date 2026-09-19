import { axe } from '@sanvi/test-config/axe'
import { render, screen, waitFor } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ErrorDiagnostics from '../src/errors/ErrorDiagnostics.svelte'

describe('ErrorDiagnostics', () => {
  it('renders nothing — not even a wrapper — without a trace line or diagnostics text', () => {
    const { container } = render(ErrorDiagnostics, { props: {} })
    expect(container.querySelector('.sanvi-error-diagnostics')).toBeNull()
  })

  it('renders the app-localized trace line alone', () => {
    render(ErrorDiagnostics, { props: { traceLine: '参照番号：trace-123' } })
    expect(screen.getByText('参照番号：trace-123')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders the copy action and copies the whole paste in one click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    render(ErrorDiagnostics, {
      props: {
        diagnosticsText: 'Sanvi diagnostics\nrelease: abc v1.0.0\ntrace_id: trace-123',
        copyLabel: 'Copy diagnostics',
        copiedLabel: 'Copied!',
      },
    })

    screen.getByRole('button', { name: 'Copy diagnostics' }).click()
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'Sanvi diagnostics\nrelease: abc v1.0.0\ntrace_id: trace-123',
      ),
    )
    expect(await screen.findByText('Copied!')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(ErrorDiagnostics, {
      props: { traceLine: 'Reference: trace-123', diagnosticsText: 'Sanvi diagnostics' },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
