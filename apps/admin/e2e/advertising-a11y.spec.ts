import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockAdvertisingBackend } from './mock-advertising-backend'

/**
 * The e2e accessibility sweep (TASK-018). Component tests assert axe on
 * rendered fragments; this walks the real, routed screens with the real app
 * shell and fails on critical/serious violations. Moderate/minor findings
 * are tracked by the phase-11 audit (TASK-027) rather than gating here.
 *
 * Charts' text alternatives and the non-colour status encodings are
 * asserted directly (axe cannot judge "colour is the only encoding"), and
 * the builder's keyboard operability is driven step by step.
 */

async function scan(page: import('@playwright/test').Page): Promise<string[]> {
  // Visually-hidden text (the standard 1px clip) has no visual contrast
  // requirement — WCAG 1.4.3 applies to rendered text — and axe's
  // contrast check cannot see through the clip, so it is excluded here
  // rather than allowed to produce a permanent false positive.
  const results = await new AxeBuilder({ page }).exclude('.sanvi-visually-hidden').analyze()
  return results.violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.length} node(s)`)
}

test.describe('Advertising a11y sweep (10.9)', () => {
  test('the dashboard, campaigns list, diagnostics, and caps screens pass axe', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, {
      seedConnection: true,
      seedTwoCampaigns: true,
      seedCaps: true,
      seedAlerts: true,
      seedConsentVariants: true,
    })

    await page.goto('/advertising/dashboard')
    await page.getByText('Conversion value (platform)').first().waitFor({ timeout: 10_000 })
    expect(await scan(page)).toEqual([])

    await page.goto('/advertising/campaigns')
    await page.getByRole('heading', { name: 'Campaigns' }).waitFor()
    await page.getByText('¥1,500').first().waitFor({ timeout: 10_000 })
    expect(await scan(page)).toEqual([])

    await page.goto('/advertising/diagnostics')
    await page.getByRole('table').waitFor({ timeout: 10_000 })
    expect(await scan(page)).toEqual([])

    await page.goto('/advertising/budget')
    await page.getByText('Caps in place').waitFor({ timeout: 10_000 })
    expect(await scan(page)).toEqual([])

    await page.goto('/advertising/creatives')
    await page.getByRole('heading', { name: /Creatives|Creative/ }).waitFor({ timeout: 10_000 })
    expect(await scan(page)).toEqual([])
  })

  test('charts carry text alternatives and status is never colour-only', async ({ page }) => {
    mockAdvertisingBackend(page, { seedConnection: true, seedTwoCampaigns: true })
    await page.goto('/advertising/dashboard')
    await page.getByText('Conversion value (platform)').first().waitFor({ timeout: 10_000 })

    // Every chart figure is a labelled image with an accessible data table
    // one disclosure away, built from the same props.
    const charts = page.locator('svg[role="img"]')
    const chartCount = await charts.count()
    expect(chartCount).toBeGreaterThanOrEqual(2)
    for (let index = 0; index < chartCount; index += 1) {
      await expect(charts.nth(index)).toHaveAttribute('aria-label', /.+/)
    }

    // Open the first data table disclosure: the accessible table renders
    // real column headers — the chart is never the only representation.
    await page.locator('summary', { hasText: 'View as data table' }).first().click()
    const table = page.getByRole('table').first()
    await expect(table.getByRole('columnheader', { name: 'Date' })).toBeVisible()

    // Restating days are flagged with text inside the accessible table,
    // not just a colour on a bar.
    await expect(table.getByText(/Still updating/).first()).toBeVisible()
  })

  test('the campaign builder is keyboard operable across all steps', async ({ page }) => {
    mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/advertising/campaigns/new?connection=conn_live_0')

    // Step 1 by keyboard.
    await page.getByLabel(/Campaign name/).fill('Keyboard campaign')
    await page.getByLabel(/Objective/).selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Continue' }).press('Enter')

    // Step 2: the targeting step's own controls, then onward.
    await page.getByText('Who should see these ads').waitFor()
    await page.getByRole('button', { name: 'Continue' }).press('Enter')

    // Step 3: budget — the money step — by keyboard.
    await page.getByLabel(/budget amount/i).fill('2000')
    await page.getByLabel(/Budget type/).selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Continue' }).press('Enter')

    // Step 4 (creatives placeholder) and step 5 (review).
    await page.getByText('Ad creatives are added per ad group').waitFor()
    await page.getByRole('button', { name: 'Continue' }).press('Enter')
    await page.getByRole('heading', { name: 'Create a campaign' }).waitFor()
    await expect(page.getByText('Keyboard campaign')).toBeVisible()

    // Backwards works by keyboard too — the stepper links jump straight
    // to a step, and the saved value is still there.
    await page.locator('a[href="#step-budget"]').press('Enter')
    await expect(page.getByLabel(/budget amount/i)).toHaveValue('2000')
  })
})
