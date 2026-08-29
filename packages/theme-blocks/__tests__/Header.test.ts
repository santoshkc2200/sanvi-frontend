import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Header from '../src/blocks/Header.svelte'

describe('Header block', () => {
  it('renders a semantic header landmark with brand and navigation links', () => {
    render(Header, {
      props: {
        brandName: 'Sanvi Store',
        navItems: [
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
        ],
        navAriaLabel: 'Main navigation',
      },
    })

    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
    expect(screen.getByText('Sanvi Store')).toBeInTheDocument()

    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/products')
  })

  it('renders localized text when passed a locale map', () => {
    render(Header, {
      props: {
        brandName: { en: 'Sanvi Store', ja: 'サンビストア' },
        navItems: [{ label: { en: 'Catalog', ja: 'カタログ' }, href: '/catalog' }],
      },
    })

    expect(screen.getByText('Sanvi Store')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Catalog' })).toHaveAttribute('href', '/catalog')
  })

  it('renders brand logo image when brandLogoUrl is provided', () => {
    render(Header, {
      props: {
        brandName: 'Acme',
        brandLogoUrl: 'https://cdn.sanvi.dev/assets/logo.png',
      },
    })

    const logo = screen.getByRole('img', { name: 'Acme' })
    expect(logo).toHaveAttribute('src', 'https://cdn.sanvi.dev/assets/logo.png')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(Header, {
      props: {
        brandName: 'Accessible Brand',
        navItems: [
          { label: 'Shop', href: '/shop' },
          { label: 'About', href: '/about' },
        ],
        navAriaLabel: 'Site navigation',
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
