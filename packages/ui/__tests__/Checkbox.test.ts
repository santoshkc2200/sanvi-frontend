import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import Checkbox from '../src/Checkbox.svelte'

function label(text: string) {
  return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }))
}

describe('Checkbox', () => {
  it('toggles checked state via the label and input', async () => {
    render(Checkbox, { props: { children: label('Accept terms') } })
    const checkbox = screen.getByRole('checkbox', { name: 'Accept terms' })
    expect(checkbox).not.toBeChecked()

    await fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('starts checked when checked=true', () => {
    render(Checkbox, { props: { children: label('Accept terms'), checked: true } })
    expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toBeChecked()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(Checkbox, { props: { children: label('Accept terms') } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
