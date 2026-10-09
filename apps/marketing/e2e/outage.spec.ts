import { expect, test } from '@playwright/test'

/**
 * TASK-023 step 4: the marketing site's designed outage experience is that
 * nothing breaks. Every page is prerendered and fetch-free at request time
 * (`/pricing` falls back to static plans at build), so a total backend
 * outage renders the site normally — this spec pins that property: the
 * pages render their designed content while every API route would fail.
 */
test.describe('marketing under a total backend outage', () => {
  test.beforeEach(async ({ context }) => {
    // Abort every API call the way a dead backend would present: nothing
    // answers. The pages must not care.
    await context.route('**/api/**', (route) => route.abort())
  })

  test('home renders fully', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.ok()).toBe(true)
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('pricing renders the static plan fallback', async ({ page }) => {
    const response = await page.goto('/pricing')
    expect(response?.ok()).toBe(true)
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('signup renders its links into the console', async ({ page }) => {
    const response = await page.goto('/signup')
    expect(response?.ok()).toBe(true)
    await expect(page.getByRole('link', { name: 'Continue to workspace setup' })).toBeVisible()
  })
})
