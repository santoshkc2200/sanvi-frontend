import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import PrivacyFooterLinks from '../src/PrivacyFooterLinks.svelte'

const base = {
  label: 'Privacy',
  choicesLabel: 'Your privacy choices',
  choicesHref: '/privacy/choices',
  noticeLabel: 'Privacy notice',
  noticeHref: '/legal/privacy-notice',
}

describe('PrivacyFooterLinks', () => {
  it('renders the choices and notice links by default', () => {
    render(PrivacyFooterLinks, { props: base })
    const nav = screen.getByRole('navigation', { name: 'Privacy' })
    expect(nav).toBeInTheDocument()
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Your privacy choices',
      'Privacy notice',
    ])
  })

  it('adds the statutory US opt-out and limit-sensitive links when provided', () => {
    render(PrivacyFooterLinks, {
      props: {
        ...base,
        optOutLabel: 'Do Not Sell or Share My Personal Information',
        optOutHref: '/privacy/opt-out',
        sensitiveLabel: 'Limit the Use of My Sensitive Personal Information',
        sensitiveHref: '/privacy/limit-sensitive',
      },
    })
    expect(
      screen.getByRole('link', { name: 'Do Not Sell or Share My Personal Information' }),
    ).toHaveAttribute('href', '/privacy/opt-out')
    expect(
      screen.getByRole('link', {
        name: 'Limit the Use of My Sensitive Personal Information',
      }),
    ).toHaveAttribute('href', '/privacy/limit-sensitive')
  })

  it('routes through onNavigate for SPA routers', () => {
    const onNavigate = vi.fn()
    const { container } = render(PrivacyFooterLinks, { props: { ...base, onNavigate } })
    const anchor = container.querySelector('a')
    anchor?.click()
    expect(onNavigate).toHaveBeenCalledWith('/privacy/choices', expect.anything())
  })

  it('has no accessibility violations', async () => {
    const { container } = render(PrivacyFooterLinks, {
      props: { ...base, optOutLabel: 'Do Not Sell or Share', optOutHref: '/privacy/opt-out' },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
