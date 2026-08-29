import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import FeatureGrid from '../src/blocks/FeatureGrid.svelte'

describe('FeatureGrid block', () => {
  it('renders heading, subheading, and feature cards', () => {
    render(FeatureGrid, {
      props: {
        heading: 'Why Choose Us',
        subheading: 'Everything you need to succeed.',
        features: [
          { title: 'Fast Shipping', description: 'Next-day delivery available worldwide.' },
          { title: '24/7 Support', description: 'Dedicated customer service team on standby.' },
          { title: 'Secure Checkout', description: 'End-to-end encrypted payment processing.' },
        ],
      },
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Why Choose Us' })).toBeInTheDocument()
    expect(screen.getByText('Everything you need to succeed.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Fast Shipping' })).toBeInTheDocument()
    expect(screen.getByText('Next-day delivery available worldwide.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: '24/7 Support' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Secure Checkout' })).toBeInTheDocument()
  })

  it('renders localized text when passed a locale map', () => {
    render(FeatureGrid, {
      props: {
        heading: { en: 'Features', ja: '特徴' },
        features: [
          {
            title: { en: 'Quality', ja: '品質' },
            description: { en: 'Premium materials', ja: '高級素材' },
          },
        ],
      },
    })

    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('Quality')).toBeInTheDocument()
    expect(screen.getByText('Premium materials')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(FeatureGrid, {
      props: {
        heading: 'Features Overview',
        features: [
          { title: 'Feature One', description: 'Description for feature one.' },
          { title: 'Feature Two', description: 'Description for feature two.' },
        ],
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
