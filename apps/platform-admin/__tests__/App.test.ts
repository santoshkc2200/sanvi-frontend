import type { Session } from '@sanvi/auth'
import { setSession } from '@sanvi/auth'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../src/App.svelte'

const STEPPED_UP_SESSION: Session = {
  userId: 'operator-1',
  email: 'operator@example.com',
  emailVerified: true,
  status: 'active',
  memberships: [],
  aal: 'aal2',
  methods: ['password', 'totp'],
  authenticatedAt: undefined,
  locale: undefined,
}

// Every route but `login`/`step-up`/`health` requires `aal2` since phase
// 02 — App.svelte's own routing behavior is what this suite covers, not
// the guard itself (see `packages/auth/__tests__/guards.test.ts`), so
// tests that exercise a guarded route are already stepped up.
beforeEach(() => {
  setSession(STEPPED_UP_SESSION)
})

afterEach(() => {
  window.history.pushState({}, '', '/')
  setSession(null)
})

describe('App shell', () => {
  it('renders the nav and the tenants route by default', async () => {
    render(App)
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Tenants' })).toBeInTheDocument()
  })

  it('navigates to Roles when its nav link is clicked', async () => {
    render(App)
    await screen.findByRole('heading', { name: 'Tenants' })

    await fireEvent.click(screen.getByRole('link', { name: 'Roles' }))

    expect(await screen.findByRole('heading', { name: 'Roles & permissions' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Roles' })).toHaveAttribute('aria-current', 'page')
  })

  it('renders NotFound for an unmatched route', async () => {
    window.history.pushState({}, '', '/does-not-exist')
    render(App)

    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })

  it('has no accessibility violations on the default route', async () => {
    const { container } = render(App)
    await screen.findByRole('heading', { name: 'Tenants' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
