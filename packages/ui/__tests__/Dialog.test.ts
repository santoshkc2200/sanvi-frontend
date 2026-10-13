import { fireEvent, render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import Dialog from '../src/Dialog.svelte'
import DialogWithTrigger from './fixtures/DialogWithTrigger.svelte'

function body(text: string) {
  return createRawSnippet(() => ({ render: () => `<p>${text}</p>` }))
}

describe('Dialog', () => {
  it('is closed by default and opens when `open` is true', () => {
    const { container, rerender } = render(Dialog, {
      props: { titleText: 'Confirm', open: false, children: body('Are you sure?') },
    })
    expect(container.querySelector('dialog')).not.toHaveAttribute('open')

    rerender({ titleText: 'Confirm', open: true, children: body('Are you sure?') })
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
  })

  it('labels the dialog with the title for assistive tech', () => {
    render(Dialog, { props: { titleText: 'Confirm deletion', open: true, children: body('x') } })
    const dialog = screen.getByRole('dialog', { name: 'Confirm deletion' })
    expect(dialog).toBeInTheDocument()
  })

  it('closes when the close button is activated', async () => {
    render(Dialog, { props: { titleText: 'Confirm', open: true, children: body('x') } })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('open')

    await fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(dialog).not.toHaveAttribute('open')
  })

  it('renders custom close label', () => {
    render(Dialog, {
      props: { titleText: 'Confirm', open: true, closeLabel: 'Dismiss', children: body('x') },
    })
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })
})

describe('Dialog focus management (TASK-027)', () => {
  it('returns focus to the trigger on close', async () => {
    render(DialogWithTrigger)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    trigger.focus()
    await fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toHaveAttribute('open')

    await fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the trigger when the parent closes it via the bound prop', async () => {
    render(DialogWithTrigger)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    trigger.focus()
    await fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toHaveAttribute('open')

    await fireEvent.click(screen.getByRole('button', { name: 'Close from parent' }))
    expect(trigger).toHaveFocus()
  })

  it('never throws restoring focus when the trigger was removed from the DOM', async () => {
    const { unmount: _unused } = render(DialogWithTrigger)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    await fireEvent.click(trigger)
    trigger.remove()
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Close' }))).not.toThrow()
    await Promise.resolve()
  })
})
