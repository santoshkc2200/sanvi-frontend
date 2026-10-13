import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import Drawer from '../src/Drawer.svelte'

function body(text: string) {
  return createRawSnippet(() => ({ render: () => `<p>${text}</p>` }))
}

describe('Drawer', () => {
  it('opens and closes via the bound prop', async () => {
    const { container, rerender } = render(Drawer, {
      props: { titleText: 'Details', open: false, children: body('x') },
    })
    expect(container.querySelector('dialog')).not.toHaveAttribute('open')
    rerender({ titleText: 'Details', open: true, children: body('x') })
    expect(screen.getByRole('dialog', { name: 'Details' })).toHaveAttribute('open')
  })

  it('returns focus to the trigger on close (TASK-027)', async () => {
    const { rerender } = render(Drawer, {
      props: { titleText: 'Details', open: false, children: body('x') },
    })
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    await rerender({ titleText: 'Details', open: true, children: body('x') })
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
    await rerender({ titleText: 'Details', open: false, children: body('x') })
    expect(trigger).toHaveFocus()

    trigger.remove()
  })

  it('has no accessibility violations when open', async () => {
    const { container } = render(Drawer, {
      props: { titleText: 'Details', open: true, children: body('x') },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
