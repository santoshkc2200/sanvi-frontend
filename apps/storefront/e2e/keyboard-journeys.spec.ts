import { expect, test, type Page } from '@playwright/test'

/**
 * Keyboard-only critical journey (TASK-027 step 8): complete checkout
 * without a mouse. Every activation is keyboard — Tab order, Enter on the
 * focused control — no `.click()` anywhere. The hosted-payment hop is
 * answered by a route interception pointing back at the storefront's own
 * return route, so the journey completes end to end: pay button →
 * redirect → confirmation, exactly the path a real card checkout takes.
 */

/** The consent banner sits on first visit; accept it via the keyboard too. */
async function acceptConsentBannerByKeyboard(page: Page): Promise<void> {
  const banner = page.locator('.sanvi-consent-banner__actions button')
  try {
    await banner.first().waitFor({ state: 'visible', timeout: 5_000 })
  } catch {
    return // no banner this run
  }
  await banner.nth(1).focus()
  await page.keyboard.press('Enter')
  await banner.first().waitFor({ state: 'hidden', timeout: 5_000 })
}

test.describe('keyboard-only checkout journey (11.8)', () => {
  test('completes checkout end to end with the keyboard only', async ({ page }) => {
    // The hosted-payment hop: the create call's `url` comes straight back
    // here, so the Enter-activated pay button lands on the return route.
    await page.route('**/api/v1/tenant/checkout', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      await route.fulfill({
        json: {
          id: 'chk_keyboard_1',
          url: 'http://localhost:4174/checkout/return?id=chk_keyboard_1',
        },
      })
    })

    await page.goto('/checkout')
    await acceptConsentBannerByKeyboard(page)

    // Walk the Tab order to the pay button — it is reachable from the
    // keyboard and announces itself by name, not just position.
    const payButton = page.getByRole('button', { name: 'Proceed to checkout' })
    await expect(payButton).toBeEnabled()
    let focused = ''
    for (let tabs = 0; tabs < 40 && focused !== 'Proceed to checkout'; tabs += 1) {
      await page.keyboard.press('Tab')
      focused = (await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')) ?? ''
    }
    expect(focused).toBe('Proceed to checkout')

    await page.keyboard.press('Enter')

    // The journey lands on the confirmation the backend's paid checkout
    // serves — the same route a real hosted-payment return uses.
    await expect(page.getByText('Payment confirmed')).toBeVisible({ timeout: 15_000 })
  })
})
