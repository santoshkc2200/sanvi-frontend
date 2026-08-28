import type { Page } from '@playwright/test'

/**
 * Hermetic backend for the admin smoke suites. CI starts no backend for
 * `pnpm preview`, so every call the console makes must be answered here —
 * boot (`/me`), the guards, and each route's data loads. The memberships
 * mirror `@sanvi/tenant`'s old dev fixture (dev-acme / dev-globex) so the
 * tenant-switcher specs keep their assertions. Field shapes mirror
 * `packages/api-client/src/generated/types.ts`; re-check them after
 * `pnpm generate:api`.
 */
export function mockBackend(page: Page): void {
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
          'identity.member.read',
          'identity.member.invite',
          'identity.member.grant',
          'identity.member.remove',
          'identity.invitation.manage',
          'access.role.read',
          'access.role.create',
          'access.role.update',
          'access.role.delete',
          'tenancy.settings.read',
          'tenancy.settings.update',
          'payments.read',
        ],
      },
      {
        tenant_id: 'dev-globex',
        tenant_slug: 'globex',
        tenant_name: 'Globex Industries',
        role_ids: ['viewer'],
        status: 'active',
        permissions: [],
      },
    ],
  }
  const sessions = [
    {
      session_id: 'e2e-session',
      aal: 'aal1',
      methods: ['password'],
      authenticated_at: '2026-08-28T00:00:00Z',
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
  // so this fallback only answers whatever the specific routes below don't.
  page.route('**/api/v1/**', (route) => route.fulfill({ json: {} }))

  page.route('**/api/v1/me', (route) => route.fulfill({ json: me }))
  page.route('**/api/v1/me/sessions', (route) => route.fulfill({ json: sessions }))
  page.route('**/api/v1/tenant/context', (route) => route.fulfill({ json: context }))
  page.route('**/api/v1/tenant/settings', (route) =>
    route.fulfill({ json: { settings: { timezone: 'UTC' } } }),
  )
  page.route('**/api/v1/tenant/members', (route) => route.fulfill({ json: [] }))
  page.route('**/api/v1/tenant/invitations', (route) => route.fulfill({ json: [] }))
  page.route('**/api/v1/tenant/entitlements', (route) => route.fulfill({ json: [] }))
}
