import { expect, test, type Page } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * TASK-024's per-app CSP snapshot for the admin console: the production
 * build's `<meta http-equiv>` policy must be the tightened one (no
 * `unsafe-inline`, no narrowed-adspec OAuth origins), the preview server
 * must answer with the backend-specified security headers, and the real
 * console must run with zero `securitypolicyviolation` events — the local
 * production-build substitute for the report-only staging cycle
 * (`docs/security/csp-widenings.md`).
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
  // The ads preset was narrowed to creative-preview img-src (TASK-024):
  expect(csp).toContain('*.googleusercontent.com')
  expect(csp).not.toContain('accounts.google.com')
  expect(csp).not.toContain('www.facebook.com')

  // NFR-1114 security headers from the preview server (`server.headers`).
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

  // Client-side navigation over routes the hermetic backend answers.
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByRole('link', { name: 'Domains' }).click()
  await expect(page.getByRole('heading', { name: 'Domains' })).toBeVisible()

  const violations = await page.evaluate(
    () => (window as unknown as { __cspViolations: unknown[] }).__cspViolations,
  )
  expect(violations).toEqual([])
})
