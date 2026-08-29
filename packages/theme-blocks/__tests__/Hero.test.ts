import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Hero from '../src/blocks/Hero.svelte'

describe('Hero block', () => {
  it('renders heading, subtitle, CTA links, and image', () => {
    render(Hero, {
      props: {
        title: 'Supercharge Your Store',
        subtitle: 'The modern platform for digital commerce.',
        primaryCta: { label: 'Get Started', href: '/signup' },
        secondaryCta: { label: 'Learn More', href: '/about' },
        imageUrl: 'https://cdn.sanvi.dev/hero.jpg',
        imageAlt: 'Hero showcase',
      },
    })

    expect(
      screen.getByRole('heading', { level: 1, name: 'Supercharge Your Store' }),
    ).toBeInTheDocument()
    expect(screen.getByText('The modern platform for digital commerce.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/signup')
    expect(screen.getByRole('link', { name: 'Learn More' })).toHaveAttribute('href', '/about')

    const img = screen.getByRole('img', { name: 'Hero showcase' })
    expect(img).toHaveAttribute('src', 'https://cdn.sanvi.dev/hero.jpg')
  })

  it('renders localized text when passed a locale map', () => {
    render(Hero, {
      props: {
        title: { en: 'Welcome', ja: 'ようこそ' },
        subtitle: { en: 'Best products', ja: '最高の商品' },
        primaryCta: { label: { en: 'Shop Now', ja: '今すぐ購入' }, href: '/shop' },
      },
    })

    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Best products')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shop Now' })).toHaveAttribute('href', '/shop')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(Hero, {
      props: {
        title: 'Accessible Hero',
        subtitle: 'Accessible subtitle description.',
        primaryCta: { label: 'Explore', href: '/explore' },
        imageUrl: 'https://cdn.sanvi.dev/accessible.png',
        imageAlt: 'Accessible image illustration',
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
