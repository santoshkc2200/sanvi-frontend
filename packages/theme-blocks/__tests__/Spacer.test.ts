import { axe } from '@sanvi/test-config/axe'
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Spacer from '../src/blocks/Spacer.svelte'

describe('Spacer block', () => {
  it('renders an aria-hidden spacer element with correct dimension style', () => {
    const { container } = render(Spacer, {
      props: {
        size: '8',
        axis: 'block',
      },
    })

    const spacer = container.querySelector('.sanvi-block-spacer')
    expect(spacer).toBeInTheDocument()
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
    expect(spacer?.getAttribute('style')).toContain('var(--sanvi-spacing-8)')
  })

  it('supports inline axis', () => {
    const { container } = render(Spacer, {
      props: {
        size: '4',
        axis: 'inline',
      },
    })

    const spacer = container.querySelector('.sanvi-block-spacer')
    expect(spacer?.getAttribute('style')).toContain('inline-size: var(--sanvi-spacing-4)')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(Spacer, {
      props: {
        size: '6',
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
