import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import RichText from '../src/blocks/RichText.svelte'

describe('RichText block', () => {
  it('renders heading and text content with alignment', () => {
    render(RichText, {
      props: {
        heading: 'About Our Craft',
        body: 'We build quality products designed to last.',
        align: 'center',
      },
    })

    expect(screen.getByRole('heading', { level: 2, name: 'About Our Craft' })).toBeInTheDocument()
    expect(screen.getByText('We build quality products designed to last.')).toBeInTheDocument()
  })

  it('renders localized text when passed a locale map', () => {
    render(RichText, {
      props: {
        heading: { en: 'Our Story', ja: '私たちの物語' },
        body: { en: 'Founded in 2024.', ja: '2024年設立。' },
      },
    })

    expect(screen.getByText('Our Story')).toBeInTheDocument()
    expect(screen.getByText('Founded in 2024.')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(RichText, {
      props: {
        heading: 'Accessible Heading',
        body: 'Accessible paragraph body.',
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
