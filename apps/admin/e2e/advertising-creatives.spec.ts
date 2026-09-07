import { expect, test } from '@playwright/test'
import { mockAdvertisingBackend } from './mock-advertising-backend'
import { makePng, mockMediaBackend } from './mock-media-backend'

/**
 * TASK-013 end to end against hermetic mocks: the creative library lists
 * across platforms, the editor checks a placement's asset spec on real
 * measured image dimensions (a 100×100 upload is rejected for the
 * placement it fails, naming placement and dimension), a valid upload
 * creates and lists a creative, the server-computed previews render, and
 * the cross-currency campaign list renders two ad accounts natively —
 * never summed.
 */

test.describe('Advertising creatives (10.4)', () => {
  test.beforeEach(async ({ page }) => {
    mockMediaBackend(page)
    mockAdvertisingBackend(page, { seedConnection: true })
  })

  test('create through the editor: spec-checked upload, copy, list, preview, delete', async ({
    page,
  }) => {
    await page.goto('/advertising/creatives')
    await expect(page.getByRole('heading', { name: 'Creatives' })).toBeVisible()
    await expect(page.getByText('No creatives yet')).toBeVisible()

    await page.getByRole('button', { name: 'New creative' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Placements')).toBeVisible()

    // The preselected Meta connection offers its matrix placements.
    await dialog.getByRole('checkbox', { name: 'Feed' }).check()
    await dialog.getByLabel('Headline').first().fill('Summer sale')

    // An upload that fails the placement's spec is rejected for that
    // placement only, at upload, naming the placement and the dimension.
    await dialog.getByLabel('Upload image').setInputFiles({
      name: 'tiny.png',
      mimeType: 'image/png',
      buffer: makePng(100, 100),
    })
    await expect(dialog.getByText(/Feed: the image is 100 px wide/)).toBeVisible()
    await expect(dialog.getByText(/Feed: the image is 100 px tall/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Create' })).toBeDisabled()

    // Drop the placement instead of the asset — the violation clears.
    await dialog.getByRole('button', { name: 'Drop Feed' }).click()
    await expect(dialog.getByText(/Feed: the image is 100 px wide/)).toBeHidden()

    // Re-select the placement: the small asset fails it again, so this time
    // the asset goes instead — then a spec-passing upload unblocks the save.
    await dialog.getByRole('checkbox', { name: 'Feed' }).check()
    await expect(dialog.getByText(/Feed: the image is 100 px wide/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Remove image' }).first().click()
    await expect(dialog.getByText(/Feed: at least one image is required/)).toBeVisible()
    await dialog.getByLabel('Upload image').setInputFiles({
      name: 'square.png',
      mimeType: 'image/png',
      buffer: makePng(1080, 1080),
    })
    await expect(dialog.getByText(/Feed: at least one image is required/)).toBeHidden()
    await expect(dialog.getByRole('button', { name: 'Create' })).toBeEnabled()

    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('Creative created')).toBeVisible()
    await expect(page.getByRole('table').getByText('Summer sale')).toBeVisible()

    // The server-computed previews render in the preview dialog.
    await page.getByRole('button', { name: 'Preview' }).click()
    const previewDialog = page.getByRole('dialog')
    await expect(previewDialog.getByText('Summer sale')).toBeVisible()
    await previewDialog.getByRole('button', { name: 'Close' }).click()

    // Delete confirms, then reloads without the row.
    await page.getByRole('button', { name: 'Delete' }).click()
    const deleteDialog = page.getByRole('dialog')
    await expect(deleteDialog.getByText(/cannot be undone/)).toBeVisible()
    await deleteDialog.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('No creatives yet')).toBeVisible()
  })

  test('the cross-platform campaign list renders two currencies natively and never sums them', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedTwoConnections: true, seedTwoCampaigns: true })
    await page.goto('/advertising/campaigns')
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible()

    // Each campaign's budget renders in its own ad account's currency.
    await expect(page.getByText('JPY push')).toBeVisible()
    await expect(page.getByText('USD push')).toBeVisible()
    await expect(page.getByText(/¥1,500/)).toBeVisible()
    await expect(page.getByText(/\$15\.00/)).toBeVisible()
    // No total row exists: the two currencies' amounts are never added —
    // the table has no footer row to put one in.
    const table = page.getByRole('table')
    await expect(table.locator('tfoot')).toHaveCount(0)
  })
})
