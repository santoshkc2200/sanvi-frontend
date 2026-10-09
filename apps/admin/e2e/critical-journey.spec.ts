import { expect, test, type Page } from '@playwright/test'
import { AD_PLATFORM_FIXTURES } from '@sanvi/ui/test-fixtures'
import { mockAdvertisingBackend } from './mock-advertising-backend'

/**
 * TASK-023 (FR-1113): the admin console's throttled critical journey —
 * connect an ad platform through the real OAuth handoff, then load the
 * campaign manager — under the pinned midrange-android network shape
 * (`@slow-3g` project).
 *
 * Deliberately not the full TASK-018 consolidation journey: its
 * campaign-detail leg does not complete on this host even unthrottled (the
 * CampaignDetail hang documented since TASK-015, reproducible on a clean
 * base — see the task file's execution notes). The trunk of the journey —
 * connect, then the campaigns list — is what this spec pins under throttle.
 */

async function connectPlatform(
  page: Page,
  platformKey: string,
  currency: string,
  timezone: string,
): Promise<void> {
  const card = page.locator(`article[data-platform-key="${platformKey}"]`)
  await expect(card.getByText('Not connected')).toBeVisible({ timeout: 30_000 })
  await card.getByRole('button', { name: 'Connect', exact: true }).focus()
  await page.keyboard.press('Enter')

  await page.getByRole('heading', { name: 'Choose your ad account' }).waitFor({ timeout: 30_000 })
  await page.getByRole('radio', { name: /Acme Main Ad Account/ }).press('Space')
  await page.getByLabel(/Account currency/).fill(currency)
  await page.getByLabel(/Account timezone/).fill(timezone)
  await page.getByRole('button', { name: 'Connect this account' }).press('Enter')

  await expect(card.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30_000 })
}

test('connect a platform and reach the campaign manager under throttle @slow-3g', async ({
  page,
}) => {
  test.setTimeout(240_000)
  mockAdvertisingBackend(page, { seedCaps: true, seedConsentVariants: true })

  const googleAdsKey = AD_PLATFORM_FIXTURES.find((p) => p.display_name === 'Google Ads')!.key
  await page.goto('/advertising/connections')
  await connectPlatform(page, googleAdsKey, 'jpy', 'Asia/Tokyo')

  await page.goto('/advertising/campaigns')
  // The manager loads its catalog and the (empty) campaign list — under
  // throttle this is the app's real critical path: boot, catalogs, list.
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible({ timeout: 30_000 })
})
