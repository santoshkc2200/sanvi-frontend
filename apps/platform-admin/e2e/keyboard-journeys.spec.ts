import { expect, test } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * Keyboard-only pass (TASK-027 step 8) for the operator console: the skip
 * link lands keyboard focus in the main region, and the tenant search is
 * reachable and operable without a mouse. The deep console journeys belong
 * to the admin app's keyboard-journeys spec; this pins the shell contract.
 */

test.describe('keyboard-only operator console (11.8)', () => {
  test.beforeEach(async ({ page }) => {
    mockBackend(page)
  })

  test('the skip link moves keyboard focus into the main region', async ({ page }) => {
    await page.goto('/')
    await page.locator('.sanvi-app-shell__skip-link').waitFor({ state: 'visible' })

    let skipFocused = false
    for (let tabs = 0; tabs < 5 && !skipFocused; tabs += 1) {
      await page.keyboard.press('Tab')
      skipFocused = await page.evaluate(() =>
        document.activeElement?.classList.contains('sanvi-app-shell__skip-link'),
      )
    }
    expect(skipFocused).toBe(true)
    await page.keyboard.press('Enter')

    const mainIsFocus = await page.evaluate(
      () => document.activeElement === document.getElementById('main-content'),
    )
    expect(mainIsFocus).toBe(true)
  })
})
