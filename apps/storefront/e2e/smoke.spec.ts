import { expect, test } from '@playwright/test'

test('home page renders with no console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  const response = await page.goto('/')
  expect(response?.ok()).toBe(true)
  expect(consoleErrors).toEqual([])
})

test('serves a Content-Security-Policy header', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.headers()['content-security-policy']).toContain("default-src 'self'")
})

test('health endpoint reports ok status and a version', async ({ request }) => {
  const response = await request.get('/health')
  expect(response.ok()).toBe(true)
  const body = await response.json()
  expect(body.status).toBe('ok')
  expect(body.version).toBeTruthy()
})

test('404 route renders the error page', async ({ page }) => {
  const response = await page.goto('/this-route-does-not-exist')
  expect(response?.status()).toBe(404)
  await expect(page.getByText('Page not found')).toBeVisible()
})

test('SSR HTML contains inlined theme style tag with zero flash', async ({ request }) => {
  const response = await request.get('/')
  expect(response.ok()).toBe(true)
  const body = await response.text()
  expect(body).toContain('<style id="sanvi-theme">')
})

