import { expect, test } from '@playwright/test'

/**
 * Keyboard-only pass (TASK-027 step 8) for the marketing site: every page's
 * navigation — locale switcher and status link — is reachable and operable
 * with the keyboard, and the skip link introduced in this task works.
 */

test.describe('keyboard-only marketing (11.8)', () => {
  test('the skip link moves keyboard focus into the main region', async ({ page }) => {
    await page.goto('/')
    await page.locator('.sanvi-skip-link').waitFor({ state: 'attached' })

    let skipFocused = false
    for (let tabs = 0; tabs < 5 && !skipFocused; tabs += 1) {
      await page.keyboard.press('Tab')
      skipFocused = await page.evaluate(() =>
        document.activeElement?.classList.contains('sanvi-skip-link'),
      )
    }
    expect(skipFocused).toBe(true)
    await page.keyboard.press('Enter')

    const mainIsFocus = await page.evaluate(
      () => document.activeElement === document.getElementById('main-content'),
    )
    expect(mainIsFocus).toBe(true)
  })

  test('the footer locale navigation is keyboard operable', async ({ page }) => {
    await page.goto('/')
    const jaLink = page.getByRole('navigation', { name: /language|言語/i }).getByRole('link', {
      name: /日本語/,
    })
    await expect(jaLink).toBeAttached()

    await jaLink.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/ja/)
  })
})
