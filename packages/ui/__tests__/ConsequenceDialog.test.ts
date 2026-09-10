import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ConsequenceDialog from '../src/advertising/ConsequenceDialog.svelte'

function baseProps() {
  return {
    open: true,
    titleText: 'Enable auto-pause',
    consequence:
      'When monthly spend reaches ¥50,000, every campaign pauses and stops delivering immediately. Paused campaigns do not auto-resume.',
    figures: [
      { key: 'cap', label: 'Pause figure', value: '¥50,000' },
      { key: 'scope', label: 'Campaigns affected', value: '2 campaigns' },
    ],
    onConfirm: vi.fn(),
  }
}

describe('ConsequenceDialog', () => {
  it('shows the consequence statement and the labelled figures', () => {
    render(ConsequenceDialog, { props: baseProps() })
    expect(screen.getByText(/pauses and stops delivering immediately/)).toBeInTheDocument()
    expect(screen.getByText('Pause figure')).toBeInTheDocument()
    expect(screen.getByText('¥50,000')).toBeInTheDocument()
    expect(screen.getByText('2 campaigns')).toBeInTheDocument()
  })

  it('confirms immediately when no typed phrase is required', async () => {
    const onConfirm = vi.fn()
    render(ConsequenceDialog, { props: { ...baseProps(), onConfirm } })
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('keeps confirm disabled until the typed phrase matches exactly', async () => {
    const onConfirm = vi.fn()
    render(ConsequenceDialog, {
      props: {
        ...baseProps(),
        onConfirm,
        confirmationPhrase: '¥50,000',
        confirmationLabel: 'Type the pause figure to confirm',
      },
    })
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(confirm).toBeDisabled()

    const input = screen.getByRole('textbox')
    await fireEvent.input(input, { target: { value: '¥49,000' } })
    expect(confirm).toBeDisabled()

    await fireEvent.input(input, { target: { value: '¥50,000' } })
    expect(confirm).toBeEnabled()

    await fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('starts the typed phrase empty on every open', async () => {
    const { container } = render(ConsequenceDialog, {
      props: {
        ...baseProps(),
        confirmationPhrase: '¥50,000',
        confirmationLabel: 'Type to confirm',
      },
    })
    const input = container.querySelector('input')
    expect((input as HTMLInputElement | null)?.value).toBe('')
  })

  it('calls onCancel when cancelled', async () => {
    const onCancel = vi.fn()
    render(ConsequenceDialog, { props: { ...baseProps(), onCancel } })
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('renders an error message without losing the figures', () => {
    render(ConsequenceDialog, {
      props: { ...baseProps(), errorMessage: 'Could not save. Try again.' },
    })
    expect(screen.getByText('Could not save. Try again.')).toBeInTheDocument()
    expect(screen.getByText('¥50,000')).toBeInTheDocument()
  })

  it('has no accessibility violations with a typed phrase and figures', async () => {
    const { container } = render(ConsequenceDialog, {
      props: {
        ...baseProps(),
        confirmationPhrase: '¥50,000',
        confirmationLabel: 'Type the pause figure to confirm',
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
