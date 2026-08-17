import { render } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import Stack from '../src/layout/Stack.svelte'

function children(html: string) {
  return createRawSnippet(() => ({ render: () => html }))
}

describe('Stack', () => {
  it('renders its children inside a flex column with a token-based gap', () => {
    // createRawSnippet's render() must return HTML for a single root
    // element — wrap the two items instead of returning them as siblings.
    const { container } = render(Stack, {
      props: { children: children('<div><p>One</p><p>Two</p></div>') },
    })
    const stack = container.querySelector('.sanvi-stack') as HTMLElement
    expect(stack.style.getPropertyValue('--sanvi-stack-gap')).toBe('var(--sanvi-spacing-4)')
    expect(stack.querySelectorAll('p')).toHaveLength(2)
  })

  it('renders as a different element via the `as` prop', () => {
    const { container } = render(Stack, {
      props: { as: 'section', children: children('<p>Content</p>') },
    })
    expect(container.querySelector('section.sanvi-stack')).toBeInTheDocument()
  })

  it('never emits a raw length — every gap value is a var() reference', () => {
    const { container } = render(Stack, {
      props: { gap: '8', children: children('<p>Content</p>') },
    })
    const gap = (container.querySelector('.sanvi-stack') as HTMLElement).style.getPropertyValue(
      '--sanvi-stack-gap',
    )
    expect(gap).toMatch(/^var\(--sanvi-spacing-\w+\)$/)
  })
})
