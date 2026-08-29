import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import FAQ from '../src/blocks/FAQ.svelte'

describe('FAQ block', () => {
  it('renders heading and accordion FAQ items', () => {
    render(FAQ, {
      props: {
        heading: 'Frequently Asked Questions',
        subheading: 'Everything you need to know about our store',
        items: [
          {
            question: 'How long does shipping take?',
            answer: 'Domestic orders typically arrive in 2-3 business days.',
          },
          {
            question: 'What is your return policy?',
            answer: 'We offer a 30-day money-back guarantee.',
          },
        ],
      },
    })

    expect(
      screen.getByRole('heading', { level: 2, name: 'Frequently Asked Questions' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Everything you need to know about our store')).toBeInTheDocument()
    expect(screen.getByText('How long does shipping take?')).toBeInTheDocument()
    expect(
      screen.getByText('Domestic orders typically arrive in 2-3 business days.'),
    ).toBeInTheDocument()
  })

  it('renders localized text when passed a locale map', () => {
    render(FAQ, {
      props: {
        heading: { en: 'FAQ', ja: 'よくある質問' },
        items: [
          {
            question: { en: 'Can I cancel?', ja: 'キャンセルできますか？' },
            answer: { en: 'Yes anytime.', ja: 'いつでも可能です。' },
          },
        ],
      },
    })

    expect(screen.getByText('FAQ')).toBeInTheDocument()
    expect(screen.getByText('Can I cancel?')).toBeInTheDocument()
    expect(screen.getByText('Yes anytime.')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(FAQ, {
      props: {
        heading: 'Accessible FAQ',
        items: [
          {
            question: 'Is this accessible?',
            answer: 'Yes, built with semantic details and summary elements.',
          },
        ],
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
