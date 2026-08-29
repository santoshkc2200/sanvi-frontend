import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Footer from '../src/blocks/Footer.svelte'

describe('Footer block', () => {
  it('renders a semantic footer landmark with brand, columns, and copyright', () => {
    render(Footer, {
      props: {
        brandName: 'Sanvi Store',
        copyrightText: '© 2026 Sanvi Inc. All rights reserved.',
        columns: [
          {
            title: 'Products',
            links: [
              { label: 'Overview', href: '/products' },
              { label: 'Pricing', href: '/pricing' },
            ],
          },
          {
            title: 'Legal',
            links: [
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms of Service', href: '/terms' },
            ],
          },
        ],
      },
    })

    const footer = screen.getByRole('contentinfo')
    expect(footer).toBeInTheDocument()
    expect(screen.getByText('Sanvi Store')).toBeInTheDocument()
    expect(screen.getByText('© 2026 Sanvi Inc. All rights reserved.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/products')
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
  })

  it('renders localized text when passed a locale map', () => {
    render(Footer, {
      props: {
        brandName: { en: 'Sanvi', ja: 'サンビ' },
        copyrightText: { en: 'All rights reserved', ja: '無断転載を禁じます' },
      },
    })

    expect(screen.getByText('Sanvi')).toBeInTheDocument()
    expect(screen.getByText('All rights reserved')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(Footer, {
      props: {
        brandName: 'Accessible Co',
        copyrightText: '© 2026 Accessible Co',
        columns: [
          {
            title: 'Navigation',
            links: [{ label: 'Home', href: '/' }],
          },
        ],
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
