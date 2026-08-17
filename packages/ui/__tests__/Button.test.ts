import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import Button from '../src/Button.svelte'

function label(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }))
}

describe('Button', () => {
  it('renders its label and responds to clicks', async () => {
    const onclick = vi.fn()
    render(Button, { props: { children: label('Save'), onclick } })

    const button = screen.getByRole('button', { name: 'Save' })
    await fireEvent.click(button)

    expect(onclick).toHaveBeenCalledOnce()
  })

  it('is disabled and non-interactive while loading', async () => {
    const onclick = vi.fn()
    render(Button, {
      props: { children: label('Save'), onclick, loading: true, loadingLabel: 'Saving' },
    })

    const button = screen.getByRole('button', { name: /Saving/ })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    await fireEvent.click(button)
    expect(onclick).not.toHaveBeenCalled()
  })

  it('applies the disabled attribute when disabled', () => {
    render(Button, { props: { children: label('Save'), disabled: true } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it.each(['primary', 'secondary', 'danger', 'ghost'] as const)(
    'has no accessibility violations — %s variant',
    async (variant) => {
      const { container } = render(Button, { props: { children: label('Save'), variant } })
      expect(await axe(container)).toHaveNoViolations()
    },
  )
})
