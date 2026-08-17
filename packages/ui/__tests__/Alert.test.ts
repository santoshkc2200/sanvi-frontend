import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import Alert from '../src/Alert.svelte'

function body(text: string) {
  return createRawSnippet(() => ({ render: () => `<p>${text}</p>` }))
}

describe('Alert', () => {
  it.each(['error', 'warning'] as const)('uses role="alert" for %s (assertive)', (variant) => {
    render(Alert, { props: { variant, children: body('Something needs attention.') } })
    expect(screen.getByRole('alert')).toHaveTextContent('Something needs attention.')
  })

  it.each(['info', 'success'] as const)('uses role="status" for %s (polite)', (variant) => {
    render(Alert, { props: { variant, children: body('All good.') } })
    expect(screen.getByRole('status')).toHaveTextContent('All good.')
  })

  it('renders an optional title', () => {
    render(Alert, { props: { title: 'Heads up', children: body('Details here.') } })
    expect(screen.getByText('Heads up')).toBeInTheDocument()
  })

  it.each(['info', 'success', 'warning', 'error'] as const)(
    'has no accessibility violations — %s variant',
    async (variant) => {
      const { container } = render(Alert, { props: { variant, children: body('Message.') } })
      expect(await axe(container)).toHaveNoViolations()
    },
  )
})
