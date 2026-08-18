import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ReasonPrompt from '../src/ReasonPrompt.svelte'

function baseProps() {
  return {
    open: true,
    titleText: 'Resend invitation',
    onConfirm: vi.fn(),
  }
}

describe('ReasonPrompt', () => {
  it('disables confirm until the reason clears the minimum length', async () => {
    render(ReasonPrompt, { props: baseProps() })
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(confirm).toBeDisabled()

    await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'short' } })
    expect(confirm).toBeDisabled()

    await fireEvent.input(screen.getByRole('textbox'), {
      target: { value: 'a long enough reason' },
    })
    expect(confirm).toBeEnabled()
  })

  it('calls onConfirm with the trimmed reason', async () => {
    const onConfirm = vi.fn()
    render(ReasonPrompt, { props: { ...baseProps(), onConfirm } })

    await fireEvent.input(screen.getByRole('textbox'), {
      target: { value: '  a long enough reason  ' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith('a long enough reason')
  })

  it('calls onCancel and closes when cancelled', async () => {
    const onCancel = vi.fn()
    render(ReasonPrompt, { props: { ...baseProps(), onCancel } })

    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
  })

  it('shows an error message when provided', () => {
    render(ReasonPrompt, { props: { ...baseProps(), errorMessage: 'Something went wrong.' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(ReasonPrompt, { props: baseProps() })
    expect(await axe(container)).toHaveNoViolations()
  })
})
