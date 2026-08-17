import { fireEvent, render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import Dialog from '../src/Dialog.svelte'

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
