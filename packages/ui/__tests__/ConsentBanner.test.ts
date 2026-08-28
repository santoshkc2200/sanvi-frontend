import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ConsentBanner from '../src/ConsentBanner.svelte'

const props = {
  open: true,
  title: 'We ask before we track',
  body: 'Some features use cookies and similar technology. You decide, per purpose.',
  purposes: [
    { key: 'analytics', label: 'Product analytics' },
    { key: 'marketing_email', label: 'Marketing email' },
    { key: 'sale_or_share', label: 'Ads and sharing' },
  ],
  acceptLabel: 'Accept all',
  rejectLabel: 'Reject all',
  chooseLabel: 'Choose purposes',
  onAcceptAll: vi.fn(),
  onRejectAll: vi.fn(),
  onChoose: vi.fn(),
}

describe('ConsentBanner (opt-in)', () => {
  it('renders title, body, purposes and three actions', () => {
    render(ConsentBanner, { props })
    expect(screen.getByRole('heading', { name: props.title })).toBeInTheDocument()
    expect(screen.getByText(props.body)).toBeInTheDocument()
    expect(screen.getByText('Marketing email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept all' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject all' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose purposes' })).toBeInTheDocument()
  })

  it('gives Reject all and Accept all identical visual weight', () => {
    const { container } = render(ConsentBanner, { props })
    const reject = screen.getByRole('button', { name: 'Reject all' })
    const accept = screen.getByRole('button', { name: 'Accept all' })
    // The compliance constraint: same variant class, same size class, same
    // DOM weight — an ordinal or size difference is a test failure.
    expect(reject.className).toBe(accept.className)
    const actions = container.querySelector('.sanvi-consent-banner__actions')
    expect(actions).not.toBeNull()
    const order = Array.from(actions?.querySelectorAll('button') ?? []).map((b) =>
      b.textContent?.trim(),
    )
    expect(order.indexOf('Reject all')).toBeLessThan(order.indexOf('Accept all'))
  })

  it('emits the choice callbacks without any override', async () => {
    render(ConsentBanner, { props })
    await fireEvent.click(screen.getByRole('button', { name: 'Reject all' }))
    expect(props.onRejectAll).toHaveBeenCalledOnce()
    await fireEvent.click(screen.getByRole('button', { name: 'Choose purposes' }))
    expect(props.onChoose).toHaveBeenCalledOnce()
  })

  it('discloses an applied GPC signal', () => {
    render(ConsentBanner, {
      props: { ...props, gpcNotice: 'We detected a browser privacy signal and applied it.' },
    })
    expect(
      screen.getByText('We detected a browser privacy signal and applied it.'),
    ).toBeInTheDocument()
  })

  it('accept with an active GPC signal asks for an explicit override first', async () => {
    render(ConsentBanner, {
      props: {
        ...props,
        gpcNotice: 'Browser signal applied.',
        gpcOverrideTitle: 'Override the signal?',
        gpcOverrideBody: 'Your browser asked us not to sell or share. Accepting overrides that.',
        gpcOverrideConfirmLabel: 'Accept anyway',
      },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    expect(props.onAcceptAll).not.toHaveBeenCalled()
    expect(
      await screen.findByText(
        'Your browser asked us not to sell or share. Accepting overrides that.',
      ),
    ).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('button', { name: 'Accept anyway' }))
    expect(props.onAcceptAll).toHaveBeenCalledWith({ overrideGpc: true })
  })

  it('renders nothing when closed', () => {
    const { container } = render(ConsentBanner, { props: { ...props, open: false } })
    expect(container.querySelector('.sanvi-consent-banner')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(ConsentBanner, { props })
    expect(await axe(container)).toHaveNoViolations()
  })
})
