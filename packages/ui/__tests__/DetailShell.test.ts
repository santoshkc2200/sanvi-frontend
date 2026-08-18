import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import DetailShell from '../src/DetailShell.svelte'

function slot(text: string) {
  return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }))
}

function baseProps() {
  return {
    title: 'Acme Corporation',
    children: slot('Tab content'),
  }
}

describe('DetailShell', () => {
  it('renders the title and body content', () => {
    render(DetailShell, { props: baseProps() })
    expect(screen.getByRole('heading', { name: 'Acme Corporation' })).toBeInTheDocument()
    expect(screen.getByText('Tab content')).toBeInTheDocument()
  })

  it('renders tabs and marks the active one', () => {
    render(DetailShell, {
      props: {
        ...baseProps(),
        tabs: [
          { href: '/tenants/1', label: 'Overview' },
          { href: '/tenants/1/entitlements', label: 'Entitlements' },
        ],
        activeHref: '/tenants/1/entitlements',
      },
    })
    expect(screen.getByRole('link', { name: 'Entitlements' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current')
  })

  it('renders a disabled tab with its reason as a title attribute', () => {
    render(DetailShell, {
      props: {
        ...baseProps(),
        tabs: [
          {
            href: '/tenants/1/domains',
            label: 'Domains',
            disabled: true,
            disabledReason: 'Ships in phase 08',
          },
        ],
      },
    })
    const disabledTab = screen.getByText('Domains')
    expect(disabledTab).toHaveAttribute('title', 'Ships in phase 08')
    expect(screen.queryByRole('link', { name: 'Domains' })).not.toBeInTheDocument()
  })

  it('calls onNavigate when a tab is clicked', async () => {
    const onNavigate = vi.fn()
    render(DetailShell, {
      props: { ...baseProps(), tabs: [{ href: '/tenants/1', label: 'Overview' }], onNavigate },
    })
    await fireEvent.click(screen.getByRole('link', { name: 'Overview' }))
    expect(onNavigate).toHaveBeenCalled()
  })

  it('renders back link, actions, and meta panel snippets', () => {
    render(DetailShell, {
      props: {
        ...baseProps(),
        backHref: '/tenants',
        backLabel: 'Back to tenants',
        primaryActions: slot('Primary action'),
        secondaryActions: slot('Secondary action'),
        meta: slot('Meta panel'),
      },
    })
    expect(screen.getByRole('link', { name: 'Back to tenants' })).toBeInTheDocument()
    expect(screen.getByText('Primary action')).toBeInTheDocument()
    expect(screen.getByText('Secondary action')).toBeInTheDocument()
    expect(screen.getByText('Meta panel')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(DetailShell, {
      props: {
        ...baseProps(),
        tabs: [{ href: '/tenants/1', label: 'Overview' }],
        activeHref: '/tenants/1',
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
