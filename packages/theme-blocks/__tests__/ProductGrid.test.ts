import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import ProductGrid from '../src/blocks/ProductGrid.svelte'

describe('ProductGrid block', () => {
  it('renders product cards with title, price, and links', () => {
    render(ProductGrid, {
      props: {
        heading: 'Featured Products',
        products: [
          {
            id: 'prod-1',
            title: 'Classic Cotton T-Shirt',
            price: '$35.00',
            href: '/products/cotton-tshirt',
            imageUrl: 'https://cdn.sanvi.dev/prod1.jpg',
            imageAlt: 'Cotton T-Shirt in Charcoal',
          },
          {
            id: 'prod-2',
            title: 'Canvas Everyday Tote',
            price: '$45.00',
            href: '/products/canvas-tote',
          },
        ],
      },
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Featured Products' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Classic Cotton T-Shirt' }),
    ).toBeInTheDocument()
    expect(screen.getByText('$35.00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Classic Cotton T-Shirt/i })).toHaveAttribute(
      'href',
      '/products/cotton-tshirt',
    )

    const img = screen.getByRole('img', { name: 'Cotton T-Shirt in Charcoal' })
    expect(img).toHaveAttribute('src', 'https://cdn.sanvi.dev/prod1.jpg')
  })

  it('renders localized text when passed a locale map', () => {
    render(ProductGrid, {
      props: {
        heading: { en: 'Best Sellers', ja: 'ベストセラー' },
        products: [
          {
            id: 'prod-1',
            title: { en: 'Minimalist Watch', ja: 'ミニマリストの時計' },
            price: '$120.00',
            href: '/products/watch',
          },
        ],
      },
    })

    expect(screen.getByText('Best Sellers')).toBeInTheDocument()
    expect(screen.getByText('Minimalist Watch')).toBeInTheDocument()
  })

  it('renders empty state when no products are provided', () => {
    render(ProductGrid, {
      props: {
        heading: 'All Products',
        products: [],
        emptyMessage: 'No products available in this category.',
      },
    })

    expect(screen.getByText('No products available in this category.')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(ProductGrid, {
      props: {
        heading: 'Accessible Storefront Grid',
        products: [
          {
            id: 'p1',
            title: 'Product 1',
            price: '$10.00',
            href: '/p1',
          },
        ],
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
