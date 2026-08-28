import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import DangerousAction from '../src/DangerousAction.svelte'

function baseProps() {
  return {
    open: true,
    titleText: 'Suspend tenant',
    consequence: 'Acme Corporation will lose access immediately.',
    onConfirm: vi.fn(),
  }
}

describe('DangerousAction', () => {
  it('shows the consequence text', () => {
    render(DangerousAction, { props: baseProps() })
    expect(screen.getByText('Acme Corporation will lose access immediately.')).toBeInTheDocument()
  })

  it('requires a reason before confirming', async () => {
    render(DangerousAction, { props: baseProps() })
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(confirm).toBeDisabled()

    await fireEvent.input(screen.getByRole('textbox'), {
      target: { value: 'billing dispute pending' },
    })
    expect(confirm).toBeEnabled()
  })

  it('keeps confirm disabled until the typed confirmation phrase matches exactly', async () => {
    render(DangerousAction, {
      props: { ...baseProps(), confirmationPhrase: 'acme' },
    })
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    const [reasonInput, phraseInput] = screen.getAllByRole('textbox')

    await fireEvent.input(reasonInput as HTMLElement, {
      target: { value: 'billing dispute pending' },
    })
    expect(confirm).toBeDisabled()

    await fireEvent.input(phraseInput as HTMLElement, { target: { value: 'wrong' } })
    expect(confirm).toBeDisabled()

    await fireEvent.input(phraseInput as HTMLElement, { target: { value: 'acme' } })
    expect(confirm).toBeEnabled()
  })

  it('calls onConfirm with the trimmed reason', async () => {
    const onConfirm = vi.fn()
    render(DangerousAction, { props: { ...baseProps(), onConfirm } })

    await fireEvent.input(screen.getByRole('textbox'), {
      target: { value: '  billing dispute pending  ' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith('billing dispute pending')
  })

  it('requires picking one of the machine-readable reasons when reasonOptions is set', async () => {
    const onConfirm = vi.fn()
    render(DangerousAction, {
      props: {
        ...baseProps(),
        onConfirm,
        reasonOptions: [
          { value: 'billing', label: 'Billing' },
          { value: 'abuse', label: 'Abuse' },
        ],
      },
    })

    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(confirm).toBeDisabled()
    // Vocabulary mode offers a select, not a free-text reason — there is no
    // way to talk the confirm button into enabling itself.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'billing' } })
    expect(confirm).toBeEnabled()

    await fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('billing')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(DangerousAction, {
      props: { ...baseProps(), confirmationPhrase: 'acme' },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
