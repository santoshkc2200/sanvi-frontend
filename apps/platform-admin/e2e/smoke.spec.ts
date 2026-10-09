import { expect, test } from '@playwright/test'
import { mockBackend } from './mock-backend'

test.beforeEach(async ({ page }) => {
  // No backend runs alongside `pnpm preview` — the console must boot and
  // render against these answers alone (see mock-backend.ts).
  mockBackend(page)
})

test('app boots and renders with no console errors @slow-3g', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  const response = await page.goto('/')
  expect(response?.ok()).toBe(true)
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('serves a Content-Security-Policy meta tag', async ({ page }) => {
  await page.goto('/')
  const content = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content')
  expect(content).toContain("default-src 'self'")
})

test('client-side navigation to Roles works without a full reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Roles' }).click()
  await expect(page.getByRole('heading', { name: 'Roles & permissions' })).toBeVisible()
  expect(page.url()).toContain('/roles')
})
