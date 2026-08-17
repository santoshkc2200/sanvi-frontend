import { expect, test } from '@playwright/test'

test('app boots and renders with no console errors', async ({ page }) => {
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

test('client-side navigation to Settings works without a full reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByText('Settings')).toBeVisible()
  expect(page.url()).toContain('/settings')
})

test('health route reports a version', async ({ page }) => {
  await page.goto('/health')
  const body = await page.locator('pre').textContent()
  const parsed = JSON.parse(body ?? '{}')
  expect(parsed.status).toBe('ok')
  expect(parsed.version).toBeTruthy()
})
