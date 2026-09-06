import type { Page } from '@playwright/test'
import { AD_PLATFORM_FIXTURES, platformViewFixture } from '@sanvi/ui/test-fixtures'

/**
 * Hermetic advertising backend for the TASK-011 connection-flow specs —
 * catalog, OAuth handoff, and a stateful connections store so disconnect
 * actually removes what connect added.
 *
 * The OAuth round-trip is simulated in-app: `oauth/start` answers an
 * `authorization_url` pointing back at this app's own callback route with
 * `state`/`code` query params, exactly as a real platform would redirect
 * into it. No third-party origin is contacted.
 *
 * The session is `aal2` with a now-stamped `authenticated_at` so the
 * backend-mirrored freshness check (300s window) passes on mutating calls.
 */

export interface MockAdConnection {
  id: string
  platform: string
  external_account_id: string
  account_name: string | null
  currency: string
  timezone: string
  status: string
  health: Record<string, unknown>
}

export function mockAdvertisingBackend(page: Page): void {
  const connections: MockAdConnection[] = []
  let pendingCounter = 0
  let connectionCounter = 0

  const me = {
    user_id: '0190f0d0-0000-7000-8000-000000000001',
    email: 'admin@example.com',
    email_verified: true,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    memberships: [
      {
        tenant_id: 'dev-acme',
        tenant_slug: 'acme',
        tenant_name: 'Acme Corporation',
        role_ids: ['owner'],
        status: 'active',
        permissions: [
          'advertising.read',
          'advertising.connect',
          'billing.subscription.read',
          'tenancy.settings.read',
        ],
      },
    ],
  }
  const sessions = [
    {
      session_id: 'e2e-ad-session',
      aal: 'aal2',
      methods: ['totp', 'password'],
      // Fresh as of page-load time — the 300s freshness window on the
      // mutating advertising endpoints stays open for the whole spec.
      authenticated_at: new Date().toISOString(),
    },
  ]
  const context = {
    tenant_id: 'dev-acme',
    slug: 'acme',
    display_name: 'Acme Corporation',
    status: 'active',
    region: 'us',
    default_locale: 'en',
    resolution_source: 'internal_header',
  }

  // Registered first — Playwright consults the *last* matching route first,
  // so this fallback only answers what the specific routes below don't.
  void page.route('**/api/v1/**', (route) => route.fulfill({ json: {} }))

  void page.route('**/api/v1/me', (route) => route.fulfill({ json: me }))
  void page.route('**/api/v1/me/sessions', (route) => route.fulfill({ json: sessions }))
  void page.route('**/api/v1/tenant/context', (route) => route.fulfill({ json: context }))
  void page.route('**/api/v1/tenant/settings', (route) =>
    route.fulfill({ json: { settings: { timezone: 'UTC' } } }),
  )
  void page.route('**/api/v1/tenant/entitlements', (route) => route.fulfill({ json: [] }))

  // The catalog comes from the backend's own committed capability-matrix
  // fixtures — the mock spells no matrix values or platform keys itself
  // (the matrix-is-the-only-source gate enforces exactly that).
  void page.route('**/api/v1/tenant/ads/platforms', (route) =>
    route.fulfill({
      json: {
        platforms: AD_PLATFORM_FIXTURES.map((fixture) =>
          platformViewFixture(fixture, {
            connection_state: connections.length > 0 ? 'connected' : 'not_connected',
          }),
        ),
      },
    }),
  )

  void page.route('**/api/v1/tenant/ads/connections/*/oauth/start', (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const platform = url.pathname.split('/')[6] ?? 'meta'
    const body = request.postDataJSON() as { redirect_uri?: string }
    void platform
    // The backend builds the platform URL; here it points back at this
    // app's callback route carrying the platform's "authorization response".
    const redirectUri = body.redirect_uri ?? ''
    pendingCounter += 1
    const state = `e2e-state-${pendingCounter}`
    const authorizationUrl = `${redirectUri}?state=${state}&code=e2e-code`
    void route.fulfill({ json: { authorization_url: authorizationUrl, state } })
  })

  void page.route('**/api/v1/tenant/ads/connections/*/oauth/callback**', (route) => {
    const platform = new URL(route.request().url()).pathname.split('/')[6] ?? 'meta'
    void platform
    void route.fulfill({
      json: {
        id: `conn_pending_${pendingCounter}`,
        platform: 'meta',
        status: 'pending',
        accounts: [
          { external_id: '111-222', display_name: 'Acme Main Ad Account' },
          { external_id: '333-444', display_name: 'Acme EU Ad Account' },
        ],
      },
    })
  })

  void page.route('**/api/v1/tenant/ads/connections', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ json: { connections } })
      return
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as {
        connection_id: string
        external_account_id: string
        currency: string
        timezone: string
      }
      const account = [
        { external_id: '111-222', display_name: 'Acme Main Ad Account' },
        { external_id: '333-444', display_name: 'Acme EU Ad Account' },
      ].find((candidate) => candidate.external_id === body.external_account_id)
      if (!account) {
        await route.fulfill({
          status: 400,
          json: { type: 'about:blank', title: 'Bad request', status: 400 },
        })
        return
      }
      const connection: MockAdConnection = {
        id: `conn_live_${connectionCounter}`,
        platform: 'meta',
        external_account_id: body.external_account_id,
        account_name: account.display_name,
        currency: body.currency.toUpperCase(),
        timezone: body.timezone,
        status: 'active',
        health: {
          can_sync: true,
          can_upload_conversions: true,
          scopes_missing: [],
          reconnect_required: false,
          token_expires_at: null,
          last_error: null,
          last_synced_at: new Date().toISOString(),
        },
      }
      connectionCounter += 1
      connections.push(connection)
      await route.fulfill({ json: connection })
      return
    }
    await route.fulfill({ json: {} })
  })

  void page.route('**/api/v1/tenant/ads/connections/conn_*', async (route) => {
    const request = route.request()
    if (request.method() !== 'DELETE') {
      await route.fulfill({ json: {} })
      return
    }
    const id = new URL(request.url()).pathname.split('/').pop() ?? ''
    const index = connections.findIndex((connection) => connection.id === id)
    if (index >= 0) connections.splice(index, 1)
    await route.fulfill({ status: 204 })
  })
}
