import { expect, test } from '@playwright/test'
import { mockAdvertisingBackend } from './mock-advertising-backend'

/**
 * TASK-016 — the ROAS dashboard. The screen must answer "is this
 * advertising making me money?" with numbers the tenant can trust: both
 * revenue figures side by side and labelled, restatement days flagged, the
 * attribution explainer one click from every ROAS figure, no cross-currency
 * total, sync failure from the backend's freshness flag, and an export
 * whose columns match the UI with no blended column.
 */

test.describe('ROAS dashboard (TASK-016)', () => {
  test('renders both revenue numbers side by side, labelled, with ROAS twice', async ({ page }) => {
    mockAdvertisingBackend(page, { seedConnection: true, seedTwoCampaigns: true })
    await page.goto('/advertising/dashboard')

    await expect(page.getByText('Conversion value (platform)').first()).toBeVisible()
    await expect(page.getByText('Revenue (Sanvi)').first()).toBeVisible()
    await expect(page.getByText('ROAS (platform)').first()).toBeVisible()
    await expect(page.getByText('ROAS (Sanvi)').first()).toBeVisible()
    // JPY renders with no decimals, in the ad account's currency.
    await expect(page.getByText(/¥\d{1,3}(,\d{3})*$/).first()).toBeVisible()
  })

  test('the attribution explainer is one click from a ROAS figure and explains both sources', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true, seedTwoCampaigns: true })
    await page.goto('/advertising/dashboard')

    const info = page.getByRole('button', { name: 'About these numbers' }).first()
    await expect(info).toBeVisible()
    await info.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Where these numbers come from')).toBeVisible()
    await expect(
      dialog
        .getByText(/they appear side by side, each labelled/i)
        .or(dialog.getByText(/never merged/i)),
    ).toBeVisible()
    // The platform rows name the connected platform, not a hardcoded list.
    await expect(dialog.getByText(/Meta Ads/).first()).toBeVisible()
  })

  test('restatement days are flagged as still updating, with the window explained', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true, seedTwoCampaigns: true })
    await page.goto('/advertising/dashboard')

    // The ◆ note paragraph (the hidden SVG <title> also carries this text).
    await expect(page.getByText(/◆ Still updating/).first()).toBeVisible()
    await expect(page.getByText(/restatement window/i).first()).toBeVisible()
    // The breakdown table marks the campaign whose recent days are restating.
    const breakdown = page.getByRole('table', { name: /Campaign performance/ })
    await expect(breakdown.getByText('Still updating').first()).toBeVisible()
  })

  test('every chart ships an accessible data table built from the same data', async ({ page }) => {
    mockAdvertisingBackend(page, { seedConnection: true, seedTwoCampaigns: true })
    await page.goto('/advertising/dashboard')

    const disclosures = page.locator('summary', { hasText: 'View as data table' })
    await expect(disclosures.first()).toBeVisible()
    await disclosures.first().click()
    const table = page.getByRole('table').first()
    await expect(table).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Date' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Spend' })).toBeVisible()
  })

  test('the export downloads labelled columns with no blended ROAS column', async ({ page }) => {
    const mock = mockAdvertisingBackend(page, { seedConnection: true, seedTwoCampaigns: true })
    // Since TASK-018 the export streams: where the File System Access API
    // exists the bytes pipe straight to a save picker, and where it does
    // not (or is disabled here — headless Chromium's picker cannot be
    // driven by Playwright) the same stream is reassembled into a Blob the
    // browser downloads. This spec exercises the fallback branch.
    await page.addInitScript(() => {
      // @ts-expect-error test seam: force the chunked-fallback download
      delete window.showSaveFilePicker
    })
    await page.goto('/advertising/dashboard')

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^sanvi-ads-\d{4}-\d{2}-\d{2}-to-.*\.csv$/)

    const csv = mock.lastExportCsv()
    expect(csv).toBeDefined()
    const header = csv!.split('\n')[0]!
    // Both ROAS columns exist, separately labelled…
    expect(header).toContain('roas_platform')
    expect(header).toContain('roas_sanvi')
    // …and no column pretends to be a single merged figure.
    const columns = header.split(',')
    expect(columns).not.toContain('roas')
    expect(columns.some((name) => name === 'conversion_value' || name === 'revenue')).toBe(false)
  })

  test('a stalled connection renders sync failed from freshness, not stale numbers as current', async ({
    page,
  }) => {
    const mock = mockAdvertisingBackend(page, { seedConnection: true, seedTwoCampaigns: true })
    mock.stallConnection()
    await page.goto('/advertising/dashboard')

    const banner = page.getByText('A connection stopped syncing')
    await expect(banner).toBeVisible()
    await expect(page.getByText(/sync failed/).first()).toBeVisible()
  })

  test('two ad accounts in different currencies render natively with differing timezones stated', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, {
      seedTwoConnections: true,
      seedTwoCampaigns: true,
    })
    await page.goto('/advertising/dashboard')

    // Each currency renders natively…
    await expect(page.getByText(/¥/).first()).toBeVisible()
    await expect(page.getByText(/\$/).first()).toBeVisible()
    // …and the differing timezones are stated, not reconciled into one.
    await expect(page.getByText(/different timezones/i)).toBeVisible()
    await expect(page.getByText(/Currencies are never added together/)).toBeVisible()
  })

  test('with the dashboard flag off the page renders its paused state and asks for no metrics', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true, dashboardDisabled: true })
    await page.goto('/advertising/dashboard')

    await expect(page.getByText('Performance dashboard is not enabled yet')).toBeVisible()
    await expect(page.getByText('Spend', { exact: true })).toHaveCount(0)
  })
})

test.describe('campaign list spend columns (TASK-016)', () => {
  test('renders real spend, conversions, and dual ROAS with the flag on', async ({ page }) => {
    mockAdvertisingBackend(page, { seedConnection: true, seedTwoCampaigns: true })
    await page.goto('/advertising/campaigns')

    const table = page.getByRole('table', { name: 'Campaigns across every connected ad platform' })
    await expect(table).toBeVisible()
    // Real spend renders in the ad account's currency; JPY has no decimals.
    // The seeded campaign spends a deterministic total (distinct from its ¥1,500 budget).
    await expect(table.getByText('¥5,100').first()).toBeVisible()
    // Both ROAS numbers per row, each labelled at the cell.
    await expect(table.getByText(/Platform\s*\d\.\d{2}/).first()).toBeVisible()
    await expect(table.getByText(/Sanvi\s*\d\.\d{2}/).first()).toBeVisible()
    await expect(table.getByRole('button', { name: 'About these numbers' }).first()).toBeVisible()
  })

  test('drops the metric columns entirely when the flag is off — never zeros', async ({ page }) => {
    mockAdvertisingBackend(page, {
      seedConnection: true,
      seedTwoCampaigns: true,
      dashboardDisabled: true,
    })
    await page.goto('/advertising/campaigns')

    const table = page.getByRole('table', { name: 'Campaigns across every connected ad platform' })
    await expect(table).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Spend' })).toHaveCount(0)
    await expect(table.getByRole('columnheader', { name: 'ROAS' })).toHaveCount(0)
    await expect(table.getByRole('columnheader', { name: 'Budget' })).toBeVisible()
  })
})
