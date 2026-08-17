import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import AppShell from '../src/AppShell.svelte'

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/settings', label: 'Settings' },
]

function slot(text: string) {
  return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }))
}

function baseProps() {
  return {
    brand: 'Sanvi Admin',
    skipLinkLabel: 'Skip to main content',
    primaryNavLabel: 'Primary',
    nav: NAV,
    currentPath: '/',
    onNavigate: vi.fn(),
    children: slot('Page body'),
  }
}

describe('AppShell', () => {
  it('renders the brand, nav items, and page content', () => {
    render(AppShell, { props: baseProps() })

    expect(screen.getByText('Sanvi Admin')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText('Page body')).toBeInTheDocument()
  })

  it('marks the nav link matching currentPath with aria-current', () => {
    render(AppShell, { props: { ...baseProps(), currentPath: '/settings' } })

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })

  it('calls onNavigate with the event and href when a nav link is clicked', async () => {
    const onNavigate = vi.fn()
    render(AppShell, { props: { ...baseProps(), onNavigate } })

    screen
      .getByRole('link', { name: 'Settings' })
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))

    expect(onNavigate).toHaveBeenCalledWith(expect.any(MouseEvent), '/settings')
  })

  it('renders the optional headerExtra, userMenu, and breadcrumb snippets when provided', () => {
    render(AppShell, {
      props: {
        ...baseProps(),
        headerExtra: slot('Tenant switcher'),
        userMenu: slot('User menu'),
        breadcrumb: slot('Home / Settings'),
      },
    })

    expect(screen.getByText('Tenant switcher')).toBeInTheDocument()
    expect(screen.getByText('User menu')).toBeInTheDocument()
    expect(screen.getByText('Home / Settings')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(AppShell, { props: baseProps() })
    expect(await axe(container)).toHaveNoViolations()
  })
})
