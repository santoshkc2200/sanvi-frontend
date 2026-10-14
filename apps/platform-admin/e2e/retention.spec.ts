import { expect, test } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * The retention surface's e2e contract (TASK-028 step 5): the per-class
 * report renders with a stalled class visibly flagged — banner plus marker,
 * never colour alone.
 */

const REPORT = {
  generated_at: '2026-10-14T00:00:00Z',
  staleness_window_hours: 48,
  classes: [
    {
      data_class: 'consent_record',
      sensitivity: 'sensitive',
      basis: 'consent',
      period_days: 1095,
      action: 'delete',
      enforcement: 'executor:privacy.retention_sweep',
      executor: 'privacy.retention_sweep',
      last_run: {
        run_at: '2026-10-13T22:00:00Z',
        action: 'delete',
        rows_affected: 12,
        executor: 'privacy.retention_sweep',
      },
      oldest_surviving_row: '2026-01-01T00:00:00Z',
      stalled: false,
    },
    {
      data_class: 'invoice',
      sensitivity: 'confidential',
      period_days: 3650,
      action: 'archive',
      enforcement: 'executor:platform.archival_sweep',
      last_run: {
        run_at: '2026-10-01T00:00:00Z',
        action: 'archive',
        rows_affected: 3,
        executor: 'platform.archival_sweep',
      },
      oldest_surviving_row: '2016-10-14T00:00:00Z',
      stalled: true,
    },
  ],
  stalled_classes: ['invoice'],
}

test.describe('retention surface (TASK-028)', () => {
  test('a stalled class is visibly flagged with the rule, last run, and oldest surviving row', async ({
    page,
  }) => {
    mockBackend(page)
    await page.route('**/api/v1/platform/privacy/retention/report', (route) =>
      route.fulfill({ json: REPORT }),
    )

    await page.goto('/retention')

    const table = page.getByRole('table')
    await expect(table).toBeVisible()
    await expect(table).toContainText('consent_record')
    await expect(table).toContainText('1095')
    await expect(table).toContainText('12')

    // The stalled flag: banner naming the window plus a per-row marker.
    await expect(page.getByText(/staleness window missed/)).toBeVisible()
    await expect(page.locator('[data-retention="stalled"]')).toBeVisible()
  })

  test('the report endpoint being absent renders the honest gap state, never an empty table', async ({
    page,
  }) => {
    mockBackend(page)
    await page.route('**/api/v1/platform/privacy/retention/report', (route) =>
      route.fulfill({ status: 404, json: {} }),
    )

    await page.goto('/retention')

    await expect(page.getByText(/not exposed by this backend build/)).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
  })
})
