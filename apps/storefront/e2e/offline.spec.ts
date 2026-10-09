import { expect, test } from '@playwright/test'

/**
 * TASK-023 steps 7+8: the storefront's offline variant (FR-1113). The tab
 * goes offline *after* load — the honest scenario for a browsing session —
 * and the page must say what that means: browsing continues, but actions
 * that need the servers will not go through, and checkout is never queued.
 *
 * Chromium-only: `context.setOffline` is a chromium-family emulation; the
 * offline project pins it.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'offline emulation runs on the pinned chromium',
)

test.describe('offline storefront @offline', () => {
  test('the offline banner appears and clears on reconnect', async ({ page, context }) => {
    await page.goto('/', { waitUntil: 'load' })
    await expect(page.locator('[data-connectivity="offline"]')).toHaveCount(0)

    await context.setOffline(true)
    await expect(page.getByText("You're offline")).toBeVisible()
    await expect(page.getByText(/Actions that need our servers|サーバーが必要な操作/)).toBeVisible()

    await context.setOffline(false)
    await expect(page.locator('[data-connectivity="offline"]')).toHaveCount(0)
  })

  test('checkout says plainly that nothing is queued while offline', async ({ page, context }) => {
    await page.goto('/checkout', { waitUntil: 'load' })
    // The checkout route is ssr=false: wait for hydration to finish before
    // cutting the network, so the offline event lands on a live page — the
    // real scenario (page loaded, browsing, network drops).
    await expect(page.getByText('Order summary')).toBeVisible()
    await context.setOffline(true)

    await expect(page.getByText(/Checkout needs a connection/)).toBeVisible()
    // The honesty bar: the message must say nothing was placed.
    await expect(page.getByText(/Nothing has been placed/)).toBeVisible()
  })
})
