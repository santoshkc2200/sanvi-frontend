import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ConsentPreferences from '../src/ConsentPreferences.svelte'

const rows = [
  {
    key: 'analytics',
    label: 'Product analytics',
    description: 'Helps us understand which pages are used.',
    consequence: 'We record page views and feature usage for this store.',
    vendors: 'Vendors: Sanvi',
    allowed: false,
    source: 'Default',
  },
  {
    key: 'sale_or_share',
    label: 'Ads and sharing',
    description: 'Personalised ads on other sites.',
    consequence: 'Your browsing may be shared with ad platforms.',
    allowed: true,
    source: 'Your choice',
  },
]

describe('ConsentPreferences', () => {
  it('renders a checkbox row per purpose with description, consequence and source', () => {
    render(ConsentPreferences, { props: { label: 'Privacy preferences', rows, onchange: vi.fn() } })
    const group = screen.getByRole('group', { name: 'Privacy preferences' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Product analytics/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Ads and sharing/ })).toBeChecked()
    expect(
      screen.getByText('We record page views and feature usage for this store.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Your choice')).toBeInTheDocument()
  })

  it('emits onchange with the row key and new state', async () => {
    const onchange = vi.fn()

    render(ConsentPreferences, { props: { label: 'Preferences', rows, onchange } })
    await fireEvent.click(screen.getByRole('checkbox', { name: /Product analytics/ }))
    expect(onchange).toHaveBeenCalledWith('analytics', true)
  })

  it('shows the GPC status row when a signal was applied', () => {
    render(ConsentPreferences, {
      props: {
        label: 'Preferences',
        rows,
        gpcNote: 'A browser privacy signal is active for ads and sharing.',
        onchange: vi.fn(),
      },
    })
    expect(screen.getByText(/browser privacy signal is active/)).toBeInTheDocument()
  })

  it('renders a locked row with its note and an explicit override action', async () => {
    const onOverride = vi.fn()

    render(ConsentPreferences, {
      props: {
        label: 'Preferences',
        rows: [
          {
            ...rows[1]!,
            allowed: false,
            locked: true,
            lockedNote: 'Held by your browser privacy signal.',
            source: 'Browser signal',
          },
        ],
        overrideLabel: 'Override signal',
        onchange: vi.fn(),
        onOverride,
      },
    })
    const checkbox = screen.getByRole('checkbox', { name: /Ads and sharing/ })
    expect(checkbox).toBeDisabled()
    expect(screen.getByText('Held by your browser privacy signal.')).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('button', { name: 'Override signal' }))
    expect(onOverride).toHaveBeenCalledWith('sale_or_share')
  })

  it('renders the sensitive-data section when provided', () => {
    render(ConsentPreferences, {
      props: {
        label: 'Preferences',
        rows,
        sensitiveTitle: 'Sensitive personal information',
        sensitiveRows: [
          {
            key: 'sensitive_pi_use',
            label: 'Limit sensitive data use',
            description: 'Health and precise location data.',
            consequence: 'Limited to what the service requires.',
            allowed: false,
          },
        ],
        onchange: vi.fn(),
      },
    })
    expect(
      screen.getByRole('heading', { name: 'Sensitive personal information' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Limit sensitive data use/ })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(ConsentPreferences, {
      props: {
        label: 'Preferences',
        rows,
        sensitiveTitle: 'Sensitive personal information',
        sensitiveRows: rows,
        gpcNote: 'Signal active.',
        onchange: vi.fn(),
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
