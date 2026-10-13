import { join } from 'node:path'
import { expect, test } from '@playwright/test'

/**
 * Assistive-tech media passes (TASK-027 step 7): `prefers-reduced-motion`
 * and `forced-colors: active`, emulated per context. The motion contract is
 * pinned behaviourally — the one animated surface in the product (the
 * Spinner; charts and the theme previewer carry no animation at all, only
 * 150 ms colour transitions, which are not vestibular triggers) slows under
 * reduced motion exactly as its stylesheet declares.
 */

test.describe('reduced motion and forced colours (11.8)', () => {
  test('the spinner slows under prefers-reduced-motion', async ({ page }) => {
    // Hold the checkout poll open so the confirming state's spinner is on
    // screen long enough to measure.
    await page.route('**/api/v1/tenant/checkout/chk_motion*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500))
      await route.fulfill({
        json: { id: 'chk_motion_1', status: 'paid', reference: 'ord_motion' },
      })
    })

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/checkout/return?id=chk_motion_1')

    // The confirming state announces through a status region; the animated
    // element inside it is the spinner itself.
    await page.getByRole('status').waitFor()
    const duration = await page
      .locator('.sanvi-spinner')
      .first()
      .evaluate((el) => getComputedStyle(el).animationDuration)
    expect(duration).toBe('1.5s')
  })

  test('pages render under forced colours', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The page still renders content the system colours cannot hide.
    await expect(page.getByRole('main')).toBeVisible()
    const scroll = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.innerWidth + 1)
    await page.screenshot({
      path: join(
        process.cwd(),
        '..',
        '..',
        'docs',
        'a11y',
        'screenshots',
        'storefront-en-forced-colors.png',
      ),
      fullPage: true,
    })
  })
})
