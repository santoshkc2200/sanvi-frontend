import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import PrivacyNoticeBanner from '../src/PrivacyNoticeBanner.svelte'

const props = {
  open: true,
  title: 'Notice at collection',
  body: 'This store collects the categories below. You can opt out at any time — no account needed.',
  categories: ['Contact details', 'Order history', 'Usage data'],
  saleShareNote:
    'We do not sell or share personal information for cross-context advertising unless you allow it.',
  choicesLabel: 'Your privacy choices',
  choicesHref: '/privacy/choices',
  noticeLabel: 'Privacy notice',
  noticeHref: '/legal/privacy-notice',
  acknowledgeLabel: 'Got it',
  onAcknowledge: vi.fn(),
}

describe('PrivacyNoticeBanner (notice-and-opt-out)', () => {
  it('renders as a non-modal region with categories and the sale/share sentence', () => {
    render(PrivacyNoticeBanner, { props })
    const region = screen.getByRole('region', { name: props.title })
    expect(region).toBeInTheDocument()
    expect(screen.getByText(/Order history/)).toBeInTheDocument()
    expect(screen.getByText(props.saleShareNote)).toBeInTheDocument()
  })

  it('links to the preference centre and the notice, and acknowledges without recording consent', async () => {
    render(PrivacyNoticeBanner, { props })
    expect(screen.getByRole('link', { name: 'Your privacy choices' })).toHaveAttribute(
      'href',
      '/privacy/choices',
    )
    expect(screen.getByRole('link', { name: 'Privacy notice' })).toHaveAttribute(
      'href',
      '/legal/privacy-notice',
    )
    await fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(props.onAcknowledge).toHaveBeenCalledOnce()
  })

  it('renders no consent-styled primary action', () => {
    // The only button acknowledges the notice; nothing here records consent.
    render(PrivacyNoticeBanner, { props })
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveTextContent('Got it')
  })

  it('renders nothing when closed', () => {
    const { container } = render(PrivacyNoticeBanner, { props: { ...props, open: false } })
    expect(container.querySelector('.sanvi-notice-collection')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(PrivacyNoticeBanner, { props })
    expect(await axe(container)).toHaveNoViolations()
  })
})
