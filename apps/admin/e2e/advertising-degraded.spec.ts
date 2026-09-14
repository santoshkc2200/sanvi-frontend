import { expect, test } from '@playwright/test'
import { mockAdvertisingBackend, type AdvertisingMockControls } from './mock-advertising-backend'

/**
 * Degraded mode (TASK-018): when a platform is unreachable, every affected
 * screen names *which* platform and *what* is stale — a generic error in a
 * cross-platform console is how "your numbers are wrong" tickets start. The
 * screens recover without a reload once the platform returns: the banner's
 * own refresh action clears it.
 */

test.describe('Advertising degraded mode (10.9)', () => {
  let mock: AdvertisingMockControls

  test.beforeEach(async ({ page }) => {
    mock = mockAdvertisingBackend(page, {
      seedTwoConnections: true,
      seedTwoCampaigns: true,
      seedCaps: true,
    })
  })

  test('each affected screen names the unreachable platform and what is stale', async ({
    page,
  }) => {
    // Google Ads (the second connection) goes unreachable: ingestion stops.
    mock.unreachablePlatform('conn_live_1')

    // The dashboard: the banner names Google Ads, says when it stopped, and
    // describes the stale scope — metrics, cap progress, conversion uploads,
    // never implying the campaigns stopped.
    await page.goto('/advertising/dashboard')
    const banner = page.getByRole('region', { name: /stopped syncing/i })
    await expect(banner).toBeVisible({ timeout: 10_000 })
    await expect(banner.getByText(/Google Ads: sync failed/)).toBeVisible()
    await expect(
      banner.getByText(/Metrics, budget progress, and conversion uploads for Google Ads/),
    ).toBeVisible()
    await expect(banner.getByText(/keep delivering on the platform/)).toBeVisible()

    // The campaign list: the performance columns are what go stale there,
    // and the rows carry on regardless.
    await page.goto('/advertising/campaigns')
    const listBanner = page.getByRole('region', { name: /stopped syncing/i })
    await expect(listBanner).toBeVisible({ timeout: 10_000 })
    await expect(listBanner.getByText(/Google Ads: sync failed/)).toBeVisible()
    // Both campaigns still render — the list itself is Sanvi's data.
    await expect(page.getByRole('table').getByText('JPY push')).toBeVisible()
    await expect(page.getByRole('table').getByText('USD push')).toBeVisible()

    // Budget caps: the stale figure label names the platform behind it.
    await page.goto('/advertising/budget')
    await expect(page.getByText(/Stale — Google Ads — last synced/).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('recovers without a reload once the platform returns', async ({ page }) => {
    mock.unreachablePlatform('conn_live_1')
    await page.goto('/advertising/dashboard')
    const banner = page.getByRole('region', { name: /stopped syncing/i })
    await expect(banner).toBeVisible({ timeout: 10_000 })

    // Marker: if the recovery needed a page load, this would vanish.
    await page.evaluate(() => {
      ;(window as unknown as { __degradedProbe: boolean }).__degradedProbe = true
    })

    // The platform returns; the banner's own refresh action clears it.
    mock.restorePlatform('conn_live_1')
    await banner.getByRole('button', { name: 'Refresh' }).click()

    await expect(page.getByRole('region', { name: /stopped syncing/i })).toHaveCount(0, {
      timeout: 10_000,
    })
    await expect(page.getByText(/Google Ads: sync failed/).first()).toHaveCount(0)
    expect(
      await page.evaluate(
        () => (window as unknown as { __degradedProbe?: boolean }).__degradedProbe,
      ),
    ).toBe(true)
  })
})
