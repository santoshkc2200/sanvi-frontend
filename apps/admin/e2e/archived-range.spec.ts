import { expect, test, type Page } from '@playwright/test'
import { mockAdvertisingBackend } from './mock-advertising-backend'

/**
 * The ROAS dashboard over archived ranges (TASK-028): a metrics read whose
 * window overlaps archived storage refuses with 409 `archived-range`. The
 * dashboard must say so — a fully archived window renders the archived state
 * naming the restore path, a partially archived window renders the live half
 * plus an honest partial notice — never an empty chart, a zero, or a spinner.
 */

function problem409(): { status: number; contentType: string; json: Record<string, unknown> } {
  return {
    status: 409,
    contentType: 'application/problem+json',
    json: {
      type: 'https://sanvi.app/problems/conflict',
      title: 'Conflict',
      status: 409,
      detail: 'the requested window overlaps archived storage',
      reason: 'archived-range',
    },
  }
}

async function mockSummaryArchived(page: Page): Promise<void> {
  await page.route('**/api/v1/tenant/ads/metrics/summary**', (route) => route.fulfill(problem409()))
}

test.describe('archived-range dashboard (TASK-028)', () => {
  test('a fully archived range renders the archived state naming the restore path', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true })
    await mockSummaryArchived(page)
    // The rows read carries a query string; a regex keeps `/summary` out of
    // this route (a glob's `?` would be a single-char wildcard).
    await page.route(/\/api\/v1\/tenant\/ads\/metrics\?/, (route) => route.fulfill(problem409()))

    await page.goto('/advertising/dashboard')

    const state = page.locator('[data-archived="range"]')
    await expect(state).toBeVisible()
    await expect(state).toContainText('This window is archived')
    await expect(state).toContainText(/restore/i)
    // Never an empty chart, a zero, or a loading state.
    await expect(page.getByText('No data in this range yet')).toHaveCount(0)
    await expect(page.getByText('Loading performance data')).toHaveCount(0)
  })

  test('a partially archived range renders the live half and names the archived part', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true, seedTwoCampaigns: true })
    // Only the summary read refuses — the rows read (charts, breakdown) is live.
    await mockSummaryArchived(page)

    await page.goto('/advertising/dashboard')

    await expect(page.getByText('Part of this view is archived')).toBeVisible()
    await expect(page.getByText(/restore/i).first()).toBeVisible()
    // The live half still renders — the charts come from the rows read.
    await expect(page.getByRole('heading', { name: /Spend vs revenue/ }).first()).toBeVisible()
    await expect(page.getByText('No data in this range yet')).toHaveCount(0)
  })
})
