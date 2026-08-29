import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Testimonials from '../src/blocks/Testimonials.svelte'

describe('Testimonials block', () => {
  it('renders heading and testimonials with quote and author', () => {
    render(Testimonials, {
      props: {
        heading: 'Loved by thousands',
        testimonials: [
          {
            quote: 'The easiest platform we have ever used.',
            author: 'Sarah Connor',
            role: 'Founder, TechFlow',
          },
          {
            quote: 'Our revenue doubled within two months.',
            author: 'John Doe',
            role: 'E-Commerce Manager',
          },
        ],
      },
    })

    expect(
      screen.getByRole('heading', { level: 2, name: 'Loved by thousands' }),
    ).toBeInTheDocument()
    expect(screen.getByText('“The easiest platform we have ever used.”')).toBeInTheDocument()
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument()
    expect(screen.getByText('Founder, TechFlow')).toBeInTheDocument()
  })

  it('renders localized text when passed a locale map', () => {
    render(Testimonials, {
      props: {
        heading: { en: 'Customer Stories', ja: 'お客様の声' },
        testimonials: [
          {
            quote: { en: 'Great service!', ja: '素晴らしいサービス！' },
            author: { en: 'Taro', ja: '太郎' },
          },
        ],
      },
    })

    expect(screen.getByText('Customer Stories')).toBeInTheDocument()
    expect(screen.getByText('“Great service!”')).toBeInTheDocument()
    expect(screen.getByText('Taro')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(Testimonials, {
      props: {
        heading: 'Reviews',
        testimonials: [
          {
            quote: 'Accessible design and outstanding performance.',
            author: 'Alex Morgan',
          },
        ],
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
