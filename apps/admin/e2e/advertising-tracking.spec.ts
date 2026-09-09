import { expect, test } from '@playwright/test'
import { mockAdvertisingBackend } from './mock-advertising-backend'

/**
 * TASK-014 — the conversion-tracking setup screen and the captured-
 * conversions list. The mapping matrix must round-trip through PUT, the
 * test event must answer within one interaction, and the conversions list
 * must show the directive outcome and an upload column that is labelled
 * rather than blank.
 */

test.describe('advertising conversion tracking (TASK-014)', () => {
  test('the mapping matrix renders per platform and round-trips a save', async ({ page }) => {
    const mock = mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/advertising/tracking')

    await expect(page.getByRole('heading', { name: 'Conversion tracking' })).toBeVisible()

    // The matrix: one row per event, one column per platform.
    await expect(page.getByRole('rowheader', { name: 'purchase' })).toBeVisible()
    const metaAction = page.getByLabel('Conversion action for Meta Ads')
    await expect(metaAction).toHaveValue('MetaPurchase123')

    // Edit a cell and save — the PUT must carry the full edited matrix.
    await metaAction.fill('MetaPurchase999')
    await page.getByRole('button', { name: 'Save mappings' }).click()
    await expect.poll(() => mock.settingsSavedCount()).toBe(1)

    // The round-trip: a reload reads back what was saved.
    await page.reload()
    await expect(page.getByLabel('Conversion action for Meta Ads')).toHaveValue('MetaPurchase999')
  })

  test('the consent linkage names the purposes and links to the privacy centre', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/advertising/tracking')

    await expect(page.getByText('Privacy dependency')).toBeVisible()
    const copy = await page
      .getByText(/captured, but uploaded to ad platforms only while/)
      .textContent()
    expect(copy).toContain('Ad measurement')
    expect(copy).toContain('Sale or sharing for cross-context advertising')
    expect(copy).toContain('Global Privacy Control')
    await expect(page.getByRole('link', { name: 'Open the privacy centre' })).toHaveAttribute(
      'href',
      '/privacy',
    )
  })

  test('the one-click test event answers with captured, decision, and click ids', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/advertising/tracking')

    await page.getByLabel('Order value (minor units, optional)').fill('4800')
    await page.getByLabel('Currency (optional)').fill('JPY')
    await page.getByRole('button', { name: 'Send test event' }).click()

    // One interaction: the result shows all three panels together.
    const result = page.getByRole('region', { name: 'Test result' })
    await expect(result).toBeVisible()
    await expect(result.getByText('¥4,800')).toBeVisible()
    await expect(
      result.getByText('Upload permitted — no directive suppresses this event.'),
    ).toBeVisible()
    await expect(result.getByText('gclid-e2e-1')).toBeVisible()
  })

  test('the conversions list shows outcomes and per-platform upload states', async ({ page }) => {
    mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/advertising/conversions')

    const table = page.getByRole('table', { name: 'Captured conversion events' })
    await expect(table).toBeVisible()

    // Permitted event: value rendered natively in the account currency.
    await expect(table.getByText('¥4,800').first()).toBeVisible()
    await expect(table.getByText('Captured — uploads permitted').first()).toBeVisible()

    // The suppressed event names the denying purpose and the signal source.
    await expect(
      table.getByText(/suppressed by Sale or sharing for cross-context advertising/),
    ).toBeVisible()
    await expect(table.getByText(/signal: Gpc/)).toBeVisible()

    // Upload status (lit by TASK-015): the permitted event shows its uploaded
    // state; the suppressed one a labelled note — never blank.
    await expect(table.getByText('Uploaded').first()).toBeVisible()
    await expect(table.getByText('Not uploaded — no platform attempts recorded')).toBeVisible()
  })

  test('the tracking screen can be reached from the primary nav', async ({ page }) => {
    mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/')

    await page.getByRole('link', { name: 'Tracking' }).click()
    await expect(page).toHaveURL(/\/advertising\/tracking$/)
    await expect(page.getByRole('heading', { name: 'Conversion tracking' })).toBeVisible()
  })
})
