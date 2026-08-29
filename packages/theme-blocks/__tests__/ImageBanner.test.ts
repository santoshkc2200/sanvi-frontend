import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import ImageBanner from '../src/blocks/ImageBanner.svelte'

describe('ImageBanner block', () => {
  it('renders image banner with heading, subheading, and CTA link', () => {
    render(ImageBanner, {
      props: {
        imageUrl: 'https://cdn.sanvi.dev/banner.jpg',
        imageAlt: 'Summer Sale',
        heading: 'Summer Collection',
        subheading: 'Up to 40% off selected apparel',
        cta: { label: 'Shop Sale', href: '/sale' },
      },
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Summer Collection' })).toBeInTheDocument()
    expect(screen.getByText('Up to 40% off selected apparel')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shop Sale' })).toHaveAttribute('href', '/sale')

    const img = screen.getByRole('img', { name: 'Summer Sale' })
    expect(img).toHaveAttribute('src', 'https://cdn.sanvi.dev/banner.jpg')
  })

  it('renders localized text when passed a locale map', () => {
    render(ImageBanner, {
      props: {
        imageUrl: 'https://cdn.sanvi.dev/banner.jpg',
        imageAlt: { en: 'Banner', ja: 'バナー' },
        heading: { en: 'Special Offer', ja: '特別オファー' },
      },
    })

    expect(screen.getByText('Special Offer')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(ImageBanner, {
      props: {
        imageUrl: 'https://cdn.sanvi.dev/accessible-banner.jpg',
        imageAlt: 'Accessible banner image',
        heading: 'Accessible Promo',
        cta: { label: 'Discover', href: '/discover' },
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
