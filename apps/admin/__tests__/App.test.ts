import { createQuery, listCacheEntries } from '@sanvi/query'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.svelte'

afterEach(() => {
  window.history.pushState({}, '', '/')
})

describe('App shell', () => {
  it('renders the nav and the dashboard route by default', async () => {
    render(App)
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(await screen.findByText('No tenant data yet')).toBeInTheDocument()
  })

  it('navigates to Settings when its nav link is clicked', async () => {
    render(App)
    await screen.findByText('No tenant data yet')

    await fireEvent.click(screen.getByRole('link', { name: 'Settings' }))

    expect(await screen.findByText('Settings')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  })

  it('renders the tenant switcher with the dev membership list', async () => {
    render(App)
    await screen.findByText('No tenant data yet')

    expect(screen.getByRole('combobox', { name: 'Switch tenant' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Acme Corporation' })).toBeInTheDocument()
  })

  it('switching tenants clears the query cache — no stale cross-tenant data can survive the switch', async () => {
    render(App)
    await screen.findByText('No tenant data yet')

    const query = createQuery('members', async () => ['acme-row'], { tenantId: 'dev-acme' })
    await vi.waitFor(() => expect(query.data).toBeDefined())
    expect(listCacheEntries()).toHaveLength(1)

    await fireEvent.change(screen.getByRole('combobox', { name: 'Switch tenant' }), {
      target: { value: 'dev-globex' },
    })

    expect(listCacheEntries()).toHaveLength(0)
  })

  it('renders NotFound for an unmatched route', async () => {
    window.history.pushState({}, '', '/does-not-exist')
    render(App)

    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })

  it('has no accessibility violations on the default route', async () => {
    const { container } = render(App)
    await screen.findByText('No tenant data yet')
    expect(await axe(container)).toHaveNoViolations()
  })
})
