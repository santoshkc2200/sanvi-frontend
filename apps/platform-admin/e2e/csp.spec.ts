import { expect, test, type Page } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * TASK-024's per-app CSP snapshot for the platform console: same shape as
 * admin's (`apps/admin/e2e/csp.spec.ts`) — tightened meta policy, specified
 * security headers, zero violations on a real production build.
 */

async function collectViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const violations: Array<{ directive: string; disposition: string }> = []
    window.addEventListener('securitypolicyviolation', (event) => {
      violations.push({ directive: event.violatedDirective, disposition: event.disposition })
    })
    Object.defineProperty(window, '__cspViolations', { get: () => violations })
  })
}

test.beforeEach(({ page }) => {
  mockBackend(page)
})

test('the built meta policy is the tightened one and the preview server sends the specified headers', async ({
  page,
}) => {
  const response = await page.goto('/')
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content')
  expect(csp).toContain("default-src 'self'")
  expect(csp).not.toMatch(/style-src '[^']*unsafe-inline/)
  expect(csp).not.toContain('unsafe-eval')
  // platform-admin never opted into the ads preset:
  expect(csp).not.toContain('googleusercontent.com')

  expect(response?.headers()['x-content-type-options']).toBe('nosniff')
  expect(response?.headers()['referrer-policy']).toBe('same-origin')
  expect(response?.headers()['x-frame-options']).toBe('DENY')
  expect(response?.headers()['permissions-policy']).toBe(
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  )
})

test('zero CSP violations across console routes', async ({ page }) => {
  await collectViolations(page)
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()

  await page.getByRole('link', { name: 'Roles' }).click()
  await expect(page.getByRole('heading', { name: 'Roles & permissions' })).toBeVisible()

  const violations = await page.evaluate(
    () => (window as unknown as { __cspViolations: unknown[] }).__cspViolations,
  )
  expect(violations).toEqual([])
})
