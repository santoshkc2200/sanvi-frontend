/**
 * Boot-level API mocks for the axe sweep's authenticated SPA pages
 * (TASK-027 step 1). The sweep must render the consoles' real route
 * content, not their login redirect — but a Playwright `page.route` shim,
 * like the apps' e2e mock backends, is exactly the right weight here: it
 * answers boot (`/me`, tenant context, probes) so the shell mounts and each
 * route's own data loads render their designed async states when their
 * endpoints are not mocked.
 *
 * Shapes mirror `apps/admin/e2e/mock-backend.ts` and
 * `apps/platform-admin/e2e/mock-backend.ts` (re-check after
 * `pnpm generate:api`); this file stays plain JS because the harness
 * runners are plain node, not Playwright-transformed TypeScript.
 */

const ME_PERMISSIONS = [
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
  // Every route guard's permission (TASK-027 review): the sweep renders
  // each route's content, not the designed denied view.
  'advertising.read',
  'billing.subscription.read',
  'tenant.theming.read',
  'tenant.theming.write',
  'tenant.theming.publish',
]

const ADMIN_ME = {
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
      permissions: ME_PERMISSIONS,
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

const PLATFORM_ME = {
  user_id: '0190f0d0-0000-7000-8000-000000000002',
  email: 'operator@example.com',
  email_verified: true,
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  memberships: [],
}

const SESSIONS = [
  {
    session_id: 'sweep-session',
    // aal2: platform-admin's every route sits behind requireAal2 — an aal1
    // session sweeps the step-up screen instead of the routes (TASK-027
    // review). aal1 satisfies the admin console's guards.
    aal: 'aal2',
    methods: ['password'],
    authenticated_at: '2026-08-28T00:00:00Z',
  },
]

const PLAN = {
  plan_id: '0190f0d0-0000-7000-8000-000000000011',
  key: 'starter',
  name: 'Starter',
  tier: 'starter',
  sort_order: 1,
  prices: [
    {
      price_id: '0190f0d0-0000-7000-8000-000000000021',
      currency: 'USD',
      interval: 'month',
      unit_amount_minor: 2900,
      trial_days: 14,
    },
  ],
  entitlements: [],
}

const SUBSCRIPTION = {
  subscription_id: 'sub-sweep-123',
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
}

/** Routes both consoles need to boot: identity, tenant context, probes. */
// NOTE: these are registered *before* each app's specific routes (see
// ROUTES_BY_APP) — Playwright consults the last matching route first, so
// the fallback `**/api/v1/**` inside here must lose to everything below.
const SHARED = [
  ['**/api/v1/me/sessions', () => ({ json: SESSIONS })],
  ['**/api/v1/tenant/settings', () => ({ json: { settings: { timezone: 'UTC' } } })],
  ['**/api/v1/system/health', () => ({ json: { status: 'ok' } })],
  [
    '**/api/v1/system/ready',
    () => ({ json: { status: 'ok', checks: [{ name: 'database', state: 'ok' }] } }),
  ],
  // Last-resort answer so a route's data load renders its designed empty
  // state instead of an unhandled non-JSON parse.
  ['**/api/v1/**', () => ({ json: {} })],
]

const ADMIN_ROUTES = [
  ...SHARED,
  ['**/api/v1/me', () => ({ json: ADMIN_ME })],
  [
    '**/api/v1/tenant/context',
    () => ({
      json: {
        tenant_id: 'dev-acme',
        slug: 'acme',
        display_name: 'Acme Corporation',
        status: 'active',
        region: 'us',
        default_locale: 'en',
        resolution_source: 'internal_header',
      },
    }),
  ],
  ['**/api/v1/tenant/members', () => ({ json: [] })],
  ['**/api/v1/tenant/invitations', () => ({ json: [] })],
  ['**/api/v1/tenant/entitlements', () => ({ json: [] })],
  ['**/api/v1/public/plans', () => ({ json: [PLAN] })],
  ['**/api/v1/tenant/billing/subscription', () => ({ json: SUBSCRIPTION })],
  ['**/api/v1/tenant/billing/invoices', () => ({ json: [] })],
  ['**/api/v1/public/slug-availability**', () => ({ json: { available: true } })],
]

const PLATFORM_ROUTES = [
  ...SHARED,
  ['**/api/v1/me', () => ({ json: PLATFORM_ME })],
  ['**/api/v1/platform/admin/tenants**', () => ({ json: { tenants: [], next_cursor: null } })],
  ['**/api/v1/platform/impersonations', () => ({ json: [] })],
  ['**/api/v1/platform/roles', () => ({ json: [] })],
  ['**/api/v1/platform/approvals', () => ({ json: [] })],
  ['**/api/v1/platform/audit**', () => ({ json: { entries: [], next_cursor: null } })],
  ['**/api/v1/access/permissions', () => ({ json: [] })],
]

const ROUTES_BY_APP = { admin: ADMIN_ROUTES, 'platform-admin': PLATFORM_ROUTES }

/**
 * Installs the boot mock on a Playwright `BrowserContext`. Returns a stop
 * function for symmetry with the other serving helpers (context routing is
 * disposed with the context itself).
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} app
 * @returns {{ stop: () => void }}
 */
export function mockSpaApi(context, app) {
  const routes = ROUTES_BY_APP[app]
  if (!routes) return { stop() {} }
  const unroutes = routes.map(([pattern, respond]) =>
    context.route(pattern, (route) => route.fulfill(respond())),
  )
  return {
    stop() {
      for (const unroute of unroutes) unroute().catch(() => {})
    },
  }
}
