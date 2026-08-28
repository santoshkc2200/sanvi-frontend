import { expect, test } from '@playwright/test'
import { setPrivacyContext } from './fixtures/privacy-context'

/**
 * Notice-and-opt-out (US) journeys. The same component tree must render
 * this mode — switching the mocked jurisdiction changes only the backend
 * snapshot, never the page structure.
 */

async function setUsJurisdiction(page: import('@playwright/test').Page): Promise<void> {
  await setPrivacyContext(page, { jurisdiction: 'us-ca' })
}

test.describe('US notice-and-opt-out', () => {
  test('serves the notice at collection, never an opt-in modal', async ({ page }) => {
    await setUsJurisdiction(page)
    // The gated script is served by the storefront origin, so watch the
    // browser's own requests for it rather than the mock API's log.
    const scriptRequested = page.waitForEvent('request', {
      predicate: (request) => request.url().includes('mock-analytics.js'),
    })
    await page.goto('/')

    // No blocking opt-in dialog anywhere.
    await expect(page.getByRole('dialog', { name: /ask before we track/i })).toBeHidden()
    const notice = page.getByText(/Notice at collection/, { exact: true })
    await expect(notice).toBeVisible()

    // Analytics (default-allowed in this mode) loads after the snapshot resolves.
    await scriptRequested
  })

  test('the statutory opt-out link works from the footer without any login', async ({ page }) => {
    await setUsJurisdiction(page)
    await page.goto('/')

    const link = page.getByRole('link', { name: 'Do Not Sell or Share My Personal Information' })
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(/\/privacy\/opt-out/)

    // One click — no confirmation dialog between the press and the effect.
    await page.getByRole('button', { name: 'Opt out now' }).click()
    await expect(page.getByText(/Opt-out recorded/)).toBeVisible()
  })

  test('the opt-out is reflected after reload and on the preference centre', async ({ page }) => {
    await setUsJurisdiction(page)
    await page.goto('/')
    await page.goto('/privacy/opt-out')
    await page.getByRole('button', { name: 'Opt out now' }).click()
    await expect(page.getByText(/Opt-out recorded/)).toBeVisible()

    await page.goto('/privacy/choices')
    const saleOrShare = page.getByRole('checkbox', { name: /Sale or sharing/ })
    await expect(saleOrShare).not.toBeChecked()
    await expect(page.getByText(/Browser signal|Your choice/).first()).toBeVisible()

    // Analytics is not an opt-out purpose — it stays allowed.
    await expect(page.getByRole('checkbox', { name: /Product analytics/ })).toBeChecked()
  })

  test('the limit-sensitive-use control is reachable from every page footer', async ({ page }) => {
    await setUsJurisdiction(page)
    await page.goto('/')
    await page
      .getByRole('link', {
        name: 'Limit the Use of My Sensitive Personal Information',
      })
      .click()
    await expect(page).toHaveURL(/\/privacy\/limit-sensitive/)
    await page.getByRole('button', { name: 'Limit use now' }).click()
    await expect(page.getByText(/Limitation recorded/)).toBeVisible()
  })
})
