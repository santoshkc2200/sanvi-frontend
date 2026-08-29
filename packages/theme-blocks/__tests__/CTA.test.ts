import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import CTA from '../src/blocks/CTA.svelte'

describe('CTA block', () => {
  it('renders heading, description, and action buttons', () => {
    render(CTA, {
      props: {
        heading: 'Ready to get started?',
        description: 'Join thousands of merchants scaling with Sanvi today.',
        buttonText: 'Create Account',
        buttonHref: '/signup',
        secondaryButtonText: 'Talk to Sales',
        secondaryButtonHref: '/sales',
        variant: 'primary',
      },
    })

    expect(
      screen.getByRole('heading', { level: 2, name: 'Ready to get started?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Join thousands of merchants scaling with Sanvi today.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create Account' })).toHaveAttribute('href', '/signup')
    expect(screen.getByRole('link', { name: 'Talk to Sales' })).toHaveAttribute('href', '/sales')
  })

  it('renders localized text when passed a locale map', () => {
    render(CTA, {
      props: {
        heading: { en: 'Start Your Journey', ja: '旅を始めよう' },
        buttonText: { en: 'Sign Up', ja: '登録する' },
        buttonHref: '/register',
      },
    })

    expect(screen.getByText('Start Your Journey')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute('href', '/register')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(CTA, {
      props: {
        heading: 'Accessible Call to Action',
        description: 'An accessible description for this section.',
        buttonText: 'Get Started',
        buttonHref: '/start',
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
