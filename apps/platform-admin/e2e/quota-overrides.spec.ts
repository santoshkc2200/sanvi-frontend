import { expect, test } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * Per-tenant limit overrides with an audit trail (TASK-026 step 5). The
 * operator console owns the override; the backend owns the audit entry.
 * This spec pins the frontend half of that contract against the hermetic
 * mock: the grant request carries feature, limit and reason, and the audit
 * entry only appears after the grant was applied — the audit tab asserts
 * what the override produced.
 *
 * Live usage counters are intentionally not shown here: `GET
 * /api/v1/tenant/usage` is tenant-scoped and the operator console sends no
 * tenant scope, so there is no honest read to render (recorded as a
 * cross-repo gap in TASK-026's notes, not papered over with a mock).
 */

const TENANT_ID = 'quota-tenant-1'

const tenantView = {
  id: TENANT_ID,
  slug: 'quota-acme',
  display_name: 'Quota Acme',
  status: 'active',
  region: 'us',
  default_locale: 'en',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

const tenantAdminView = {
  tenant_id: TENANT_ID,
  slug: 'quota-acme',
  display_name: 'Quota Acme',
  status: 'active',
  region: 'us',
  default_locale: 'en',
  created_at: '2026-01-01T00:00:00Z',
  member_count: 3,
  override_count: 0,
  active_impersonations: 0,
}

const seatsFeature = {
  key: 'seats',
  name: 'Seats',
  kind: 'quota',
  default_enabled: true,
  default_limit: 5,
  visibility: 'public',
}

function auditEntry(limit: number) {
  return {
    id: '0190f0d0-0000-7000-8000-0000000000a1',
    seq: 42,
    tenant_id: TENANT_ID,
    actor_type: 'platform_admin',
    actor_id: 'op-1',
    action: 'entitlement.override.granted',
    resource_type: 'entitlement',
    resource_id: 'seats',
    before: null,
    after: { limit },
    occurred_at: '2026-10-10T05:00:00Z',
    request_id: 'req-quota-1',
  }
}

test.describe('Tenant quota overrides (11.7)', () => {
  test('applying a limit override produces an audit entry', async ({ page }) => {
    mockBackend(page)
    let grantSeen: Record<string, unknown> | null = null
    const overrides: unknown[] = []

    await page.route('**/api/v1/platform/tenants/quota-tenant-1', (route) =>
      route.fulfill({ json: tenantView }),
    )
    await page.route('**/api/v1/platform/admin/tenants/quota-tenant-1', (route) =>
      route.fulfill({ json: tenantAdminView }),
    )
    await page.route('**/api/v1/platform/features', (route) =>
      route.fulfill({ json: [seatsFeature] }),
    )
    await page.route('**/api/v1/platform/tenants/quota-tenant-1/entitlements', (route) => {
      if (route.request().method() === 'POST') {
        grantSeen = route.request().postDataJSON() as Record<string, unknown>
        overrides.push({
          tenant_id: TENANT_ID,
          feature: 'seats',
          enabled: true,
          limit: 20,
          granted_reason: 'E2E quota proof',
          updated_at: '2026-10-10T05:00:00Z',
        })
        return route.fulfill({ status: 201, json: 'granted' })
      }
      return route.fulfill({ json: overrides })
    })
    // The audit entry exists only after the grant — causality, not fixture.
    await page.route('**/api/v1/platform/audit**', (route) =>
      route.fulfill({
        json: {
          entries: grantSeen === null ? [] : [auditEntry(20)],
          next_cursor: null,
        },
      }),
    )

    await page.goto('/tenants/quota-tenant-1')
    await expect(page.getByRole('heading', { name: 'Quota Acme' })).toBeVisible()

    await page.getByLabel('Sections').getByRole('link', { name: 'Entitlements' }).click()
    await expect(page.getByText('Seats', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Grant' }).click()

    // Placeholders scope the fill to the open grant dialog — every lifecycle
    // dialog stays mounted with its own labelled reason field.
    await page.getByPlaceholder('Unlimited').fill('20')
    await page.getByPlaceholder('Why is this override being granted?').fill('E2E quota proof')
    await page.getByRole('button', { name: 'Save' }).click()

    // The override request carries feature, limit and reason.
    await expect(page.getByText('Seats updated for this tenant.')).toBeVisible()
    expect(grantSeen).toMatchObject({
      feature_key: 'seats',
      limit: 20,
      reason: 'E2E quota proof',
    })
    await expect(page.getByRole('cell', { name: '20' })).toBeVisible()

    // The audit tab shows the entry the override produced.
    await page.getByLabel('Sections').getByRole('link', { name: 'Audit' }).click()
    await expect(page.getByText('entitlement.override.granted')).toBeVisible()
    await expect(page.getByText('platform_admin op-1')).toBeVisible()
  })
})
