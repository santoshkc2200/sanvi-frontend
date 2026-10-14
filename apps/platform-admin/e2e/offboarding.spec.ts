import { expect, test, type Page } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * The offboarding console's e2e contract (TASK-028): the purge step is
 * unreachable in the DOM before the export verifies, and once it is offered
 * the typed confirmation must name the tenant exactly before the purge
 * command reveals. The API records and reports; the operator CLI advances
 * the record — the mock below IS that CLI, flipping the status under the
 * console's polling.
 */

const TENANT = {
  id: 'offboard-tenant-1',
  slug: 'acme',
  display_name: 'Acme',
  region: 'us',
  default_locale: 'en',
  status: 'archived',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}

const EXPORT = {
  path: '/var/lib/sanvi/exports/offboarding/acme.zip.sealed',
  checksum: 'sha256:e2e-checksum',
}

function snapshot(status: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: 'off-1',
    tenant_id: TENANT.id,
    idempotency_key: 'e2e-offboarding-key',
    status,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:01:00Z',
  }
  if (status === 'exported' || status === 'purged') {
    base.export = EXPORT
  }
  if (status === 'purged') {
    base.completed_at = '2026-10-02T00:00:00Z'
    base.purge_report = {
      tenant: TENANT.slug,
      tenant_id: TENANT.id,
      request_id: 'off-1',
      removed: { 'advertising.metrics_daily': 400 },
      lawfully_retained: [
        {
          data_class: 'invoice',
          table: 'billing.invoices',
          rows_retained: 5,
          legal_basis: 'statutory retention window (privacy.retention_rules)',
          retention_end: '2027-10-11T00:00:00+00:00',
        },
        {
          data_class: 'audit_log',
          table: 'audit.entries',
          rows_retained: 210,
          legal_basis: 'append-only chain',
          retention_end: null,
        },
      ],
      archives_purged: 2,
      cache_keys_deleted: 7,
      backup_policy_note: 'backups expire on their existing schedule',
      object_storage_note: 'media bytes live in hitox-media-service',
      search_indexes_note: 'no search infrastructure beyond Postgres full-text',
      neighbour: { tenant: 'other', byte_identical: true },
      residual_scan: 'clean',
    }
  }
  return base
}

async function mockOffboarding(page: Page, status: () => string): Promise<void> {
  mockBackend(page)
  // Registered before the offboarding route: Playwright consults the *last*
  // matching route first, so the narrower offboarding pattern wins its URL.
  await page.route('**/api/v1/platform/tenants/offboard-tenant-1', (route) =>
    route.fulfill({ json: TENANT }),
  )
  await page.route('**/api/v1/platform/tenants/offboard-tenant-1/offboarding**', (route) =>
    route.fulfill({ json: snapshot(status()) }),
  )
}

test.describe('offboarding console (TASK-028)', () => {
  test('the purge step is unreachable before the export verifies, then gated by the typed tenant confirmation', async ({
    page,
  }) => {
    let status = 'pending'
    await mockOffboarding(page, () => status)

    await page.goto('/tenants/offboard-tenant-1/offboarding')

    // Pending: the record renders, and no purge affordance exists anywhere.
    await expect(page.getByRole('heading', { name: 'Offboarding' })).toBeVisible()
    await expect(page.getByText('Pending')).toBeVisible()
    await expect(page.locator('[data-offboarding="purge-panel"]')).toHaveCount(0)
    await expect(page.locator('[data-offboarding="purge-command"]')).toHaveCount(0)

    // The CLI verifies the export; the console's polling picks it up.
    status = 'exported'
    await expect(page.locator('[data-offboarding="purge-panel"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('sha256:e2e-checksum')).toBeVisible()
    // Still no command: the typed confirmation gates it.
    await expect(page.locator('[data-offboarding="purge-command"]')).toHaveCount(0)

    await page.getByRole('button', { name: 'Prepare purge command' }).click()
    const typed = page.getByLabel(/Type to confirm/)
    await typed.fill('wrong-tenant')
    await expect(page.getByRole('button', { name: 'Reveal the purge command' })).toBeDisabled()
    await typed.fill('acme')
    await page.getByRole('button', { name: 'Reveal the purge command' }).click()

    const command = page.locator('[data-offboarding="purge-command"]')
    await expect(command).toBeVisible()
    await expect(command).toContainText('--stage purge')
    await expect(command).toContainText('acme')
    await expect(command).toContainText('e2e-offboarding-key')
  })

  test('the purge report renders removed and lawfully retained as separate lists after the purge', async ({
    page,
  }) => {
    let status = 'purging'
    await mockOffboarding(page, () => status)

    await page.goto('/tenants/offboard-tenant-1/offboarding')
    await expect(page.getByText('Purging')).toBeVisible()
    // No purge offer while the purge is under way or done.
    await expect(page.locator('[data-offboarding="purge-panel"]')).toHaveCount(0)

    status = 'purged'
    const report = page.locator('[data-offboarding="report"]')
    await expect(report).toBeVisible({ timeout: 15_000 })

    // Two clearly separated lists — never one mixed table.
    const removed = page.locator('[data-offboarding="report-removed"]')
    const retained = page.locator('[data-offboarding="report-retained"]')
    await expect(removed).toBeVisible()
    await expect(retained).toBeVisible()
    await expect(removed).toContainText('advertising.metrics_daily')
    await expect(removed).toContainText('400')
    // Each retained entry names its reason and its retention end date.
    await expect(retained).toContainText('statutory retention window')
    await expect(retained).toContainText('2027')
    await expect(retained).toContainText('append-only chain')
    await expect(retained).toContainText(/no end date/i)
    // The retained table never appears under Removed.
    await expect(removed).not.toContainText('audit.entries')
  })
})
