import type { Session } from '@sanvi/auth'
import { setSession } from '@sanvi/auth'
import { createQuery, listCacheEntries } from '@sanvi/query'
import { switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * `Dashboard`/`Settings`/`Members`/`Roles`/`Usage` all call real
 * `@sanvi/api-client` endpoints now (phase 03) — this stubs `fetch` with
 * minimal, realistic bodies so the app-shell suite stays fast and
 * deterministic without a live backend. Route-specific behavior belongs in
 * a future per-route test, not here; this only needs the app to render.
 */
function mockFetch(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  if (url.includes('/tenant/context')) {
    return Promise.resolve(
      jsonResponse({
        tenant_id: 'dev-acme',
        slug: 'acme',
        display_name: 'Acme Corporation',
        region: 'us',
        default_locale: 'en',
        status: 'active',
        resolution_source: 'subdomain',
      }),
    )
  }
  if (url.includes('/tenant/members')) return Promise.resolve(jsonResponse([]))
  if (url.includes('/tenant/invitations')) return Promise.resolve(jsonResponse([]))
  if (url.includes('/tenant/entitlements')) return Promise.resolve(jsonResponse([]))
  if (url.includes('/tenant/settings')) return Promise.resolve(jsonResponse({ settings: {} }))
  if (url.includes('/tenant/roles')) return Promise.resolve(jsonResponse([]))
  if (url.includes('/access/permissions')) return Promise.resolve(jsonResponse([]))
  if (url.includes('/tenant/billing/subscription'))
    return Promise.resolve(
      jsonResponse({
        subscription_id: 'sub-1',
        plan_key: 'starter',
        plan_name: 'Starter',
        status: 'active',
        source: 'stripe',
        collection_state: 'ok',
        cancel_at_period_end: false,
        current_period: {
          start: '2026-08-01T00:00:00Z',
          end: '2026-09-01T00:00:00Z',
        },
      }),
    )
  if (url.includes('/tenant/billing/invoices')) return Promise.resolve(jsonResponse([]))
  if (url.includes('/public/plans')) return Promise.resolve(jsonResponse([]))
  // TASK-025: the operator-signal probes answer healthy here, so the banner
  // host stays quiet — banner behavior is asserted in its own suite/e2e.
  if (url.includes('/system/ready'))
    return Promise.resolve(
      jsonResponse({ status: 'ok', checks: [{ name: 'database', state: 'ok' }] }),
    )
  if (url.includes('/system/health')) return Promise.resolve(jsonResponse({ status: 'ok' }))
  return Promise.resolve(jsonResponse({ title: 'not mocked', status: 404 }, 404))
}

const SIGNED_IN_SESSION: Session = {
  userId: 'user-1',
  email: 'alice@example.com',
  emailVerified: true,
  status: 'active',
  memberships: [
    {
      tenant_id: 'dev-acme',
      tenant_slug: 'acme',
      tenant_name: 'Acme Corporation',
      role_ids: ['role-owner'],
      permissions: ['identity.member.read', 'identity.member.grant', 'identity.member.remove'],
      status: 'active',
    },
    {
      tenant_id: 'dev-globex',
      tenant_slug: 'globex',
      tenant_name: 'Globex Industries',
      role_ids: ['role-admin'],
      permissions: ['identity.member.read'],
      status: 'active',
    },
  ],
  aal: 'aal1',
  methods: ['password'],
  authenticatedAt: undefined,
  locale: undefined,
}

// Every route but `login`/`health` is behind `requireSession` since phase
// 02 — App.svelte's own routing/tenant-switching behavior is what this
// suite covers, not the guard itself (see `packages/auth/__tests__/guards.test.ts`
// for that), so tests that exercise a guarded route sign in first.
beforeEach(() => {
  setSession(SIGNED_IN_SESSION)
  switchTenant('dev-acme')
  vi.stubGlobal('fetch', vi.fn(mockFetch))
})

afterEach(() => {
  window.history.pushState({}, '', '/')
  setSession(null)
  vi.unstubAllGlobals()
})

describe('App shell', () => {
  it('renders the nav and the dashboard route by default', async () => {
    render(App)
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(await screen.findByText('Acme Corporation')).toBeInTheDocument()
  })

  it('navigates to Settings when its nav link is clicked', async () => {
    render(App)
    await screen.findByText('Acme Corporation')

    await fireEvent.click(screen.getByRole('link', { name: 'Settings' }))

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  })

  it('renders the tenant switcher with the dev membership list', async () => {
    render(App)
    await screen.findByText('Acme Corporation')

    expect(screen.getByRole('combobox', { name: 'Switch tenant' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Acme Corporation' })).toBeInTheDocument()
  })

  it('switching tenants clears the query cache — no stale cross-tenant data can survive the switch', async () => {
    render(App)
    await screen.findByText('Acme Corporation')

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
    await screen.findByText('Acme Corporation')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('hides Billing from nav and denies route access without billing.subscription.read', async () => {
    // SIGNED_IN_SESSION does not have 'billing.subscription.read'
    render(App)
    await screen.findByText('Acme Corporation')

    expect(screen.queryByRole('link', { name: 'Billing' })).not.toBeInTheDocument()

    window.history.pushState({}, '', '/billing')
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(await screen.findByText('Access denied')).toBeInTheDocument()
  })

  it('shows Billing nav and renders Billing route with billing.subscription.read', async () => {
    setSession({
      ...SIGNED_IN_SESSION,
      memberships: [
        {
          ...SIGNED_IN_SESSION.memberships[0]!,
          permissions: ['identity.member.read', 'billing.subscription.read'],
        },
      ],
    })

    window.history.pushState({}, '', '/billing')
    render(App)

    expect(await screen.findByText('Current Subscription')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Billing' })).toBeInTheDocument()
  })

  it('allows accessing /billing when workspace is suspended so user can pay', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/billing/subscription')) {
          return Promise.resolve(
            jsonResponse({
              subscription_id: 'sub-suspended',
              plan_key: 'starter',
              plan_name: 'Starter',
              status: 'active',
              source: 'stripe',
              collection_state: 'grace_expired',
              cancel_at_period_end: false,
            }),
          )
        }
        return mockFetch(input)
      }),
    )

    setSession({
      ...SIGNED_IN_SESSION,
      memberships: [
        {
          tenant_id: 'dev-suspended',
          tenant_slug: 'suspended',
          tenant_name: 'Suspended Corp',
          role_ids: ['role-owner'],
          permissions: ['identity.member.read', 'billing.subscription.read'],
          status: 'active',
        },
      ],
    })
    switchTenant('dev-suspended')

    // On default route, suspended interstitial is shown
    window.history.pushState({}, '', '/')
    render(App)
    expect(await screen.findByText('Workspace suspended')).toBeInTheDocument()

    // On /billing route, billing page is rendered as escape hatch
    window.history.pushState({}, '', '/billing')
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(await screen.findByText('Current Subscription')).toBeInTheDocument()
  })
})
