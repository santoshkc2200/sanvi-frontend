import type { Page } from '@playwright/test'

/**
 * Hermetic backend for the smoke suites. CI starts no backend for `pnpm
 * preview`, and every route in this console sits behind `requireAal2` —
 * without these answers the app can't even boot. Field shapes mirror
 * `packages/api-client/src/generated/types.ts`; re-check them after
 * `pnpm generate:api`.
 */
export function mockBackend(page: Page): void {
  const me = {
    user_id: '0190f0d0-0000-7000-8000-000000000001',
    email: 'operator@example.com',
    email_verified: true,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    memberships: [],
  }
  const sessions = [
    {
      session_id: 'e2e-session',
      aal: 'aal2',
      methods: ['password', 'totp'],
      authenticated_at: '2026-08-28T00:00:00Z',
    },
  ]

  // Registered first — Playwright consults the *last* matching route first,
  // so this fallback only answers whatever the specific routes below don't.
  page.route('**/api/v1/**', (route) => route.fulfill({ json: {} }))

  page.route('**/api/v1/me', (route) => route.fulfill({ json: me }))
  page.route('**/api/v1/me/sessions', (route) => route.fulfill({ json: sessions }))
  page.route('**/api/v1/platform/admin/tenants**', (route) =>
    route.fulfill({ json: { tenants: [], next_cursor: null } }),
  )
  page.route('**/api/v1/platform/impersonations', (route) => route.fulfill({ json: [] }))
  page.route('**/api/v1/platform/roles', (route) => route.fulfill({ json: [] }))
  page.route('**/api/v1/platform/approvals', (route) => route.fulfill({ json: [] }))
  page.route('**/api/v1/platform/audit**', (route) =>
    route.fulfill({ json: { entries: [], next_cursor: null } }),
  )
  page.route('**/api/v1/access/permissions', (route) => route.fulfill({ json: [] }))
}
