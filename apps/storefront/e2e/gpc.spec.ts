import { expect, test } from '@playwright/test'
import { setPrivacyContext } from './fixtures/privacy-context'

/**
 * Global Privacy Control: the signal is applied on first paint, disclosed
 * in the UI, and a later "accept all" must get an explicit confirmation
 * before overriding it.
 */

test.use({
  contextOptions: {},
})

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true })
  })
  await setPrivacyContext(page, { jurisdiction: 'us-ca' })
})

test.describe('GPC', () => {
  test('the signal holds sale/share down from first paint and is disclosed', async ({ page }) => {
    await page.goto('/privacy/choices')
    await expect(page.getByText(/Global Privacy Control/)).toBeVisible()
    const saleOrShare = page.getByRole('checkbox', { name: /Sale or sharing/ })
    await expect(saleOrShare).not.toBeChecked()
    await expect(saleOrShare).toBeDisabled()
    await expect(page.getByText(/Held by your browser privacy signal/).first()).toBeVisible()
  })

  test('accept-all in opt-in mode asks before overriding the signal', async ({ page }) => {
    // EU mode: the banner is shown, the signal is disclosed on it.
    await setPrivacyContext(page, { jurisdiction: 'eu' })
    await page.goto('/')

    const banner = page.getByRole('dialog', { name: /ask before we track/i })
    await expect(banner).toBeVisible()
    await expect(banner.getByText(/Global Privacy Control/)).toBeVisible()

    // First press: no silent override — the explicit confirmation appears.
    await banner.getByRole('button', { name: 'Accept all' }).click()
    const override = page.getByRole('heading', { name: /Override your browser privacy signal/ })
    await expect(override).toBeVisible()

    // Keeping the signal dismisses the confirmation without granting.
    await page.getByRole('button', { name: 'Keep signal' }).click()
    await expect(override).toBeHidden()
    await expect(banner).toBeVisible()

    // Explicit override: banner closes, sale/share stays denied (EU default),
    // everything else is granted.
    await banner.getByRole('button', { name: 'Accept all' }).click()
    await page.getByRole('button', { name: 'Accept anyway' }).click()
    await expect(banner).toBeHidden()
  })
})
