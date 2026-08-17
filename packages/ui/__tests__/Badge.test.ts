import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import Badge from '../src/Badge.svelte'

function text(value: string) {
  return createRawSnippet(() => ({ render: () => `<span>${value}</span>` }))
}

describe('Badge', () => {
  it('renders its content', () => {
    render(Badge, { props: { children: text('Active') } })
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it.each(['neutral', 'info', 'success', 'warning', 'error'] as const)(
    'has no accessibility violations — %s variant',
    async (variant) => {
      const { container } = render(Badge, { props: { variant, children: text('Active') } })
      expect(await axe(container)).toHaveNoViolations()
    },
  )
})
