import { expect, test } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * The audit page's archived-range state (TASK-028): an audit read whose
 * window overlaps archived storage refuses with 409 `archived-range` — and
 * an unfiltered read refuses whenever any range of the chain is archived.
 * The page must say so, name the restore path, and never render the refusal
 * as "no matching audit entries".
 */

test.describe('archived-range audit (TASK-028)', () => {
  test('an archived range renders the archived state naming the restore path', async ({ page }) => {
    mockBackend(page)
    await page.route('**/api/v1/platform/audit**', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/problem+json',
        json: {
          type: 'https://sanvi.app/problems/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'the requested window overlaps archived storage',
          reason: 'archived-range',
        },
      }),
    )

    await page.goto('/audit')

    const state = page.locator('[data-archived="range"]')
    await expect(state).toBeVisible()
    await expect(state).toContainText('This window is archived')
    await expect(state).toContainText(/archive-restore/)
    // Never the empty-list copy, and no loading state left behind.
    await expect(page.getByText('No matching audit entries.')).toHaveCount(0)
    await expect(page.getByText('Loading')).toHaveCount(0)
  })
})
