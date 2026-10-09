import { expect, test, type Page } from '@playwright/test'

/**
 * TASK-024's per-app CSP snapshot for the marketing site, at both delivery
 * surfaces it actually has:
 *
 * - prerendered pages (most of the site) are served by `adapter-node`'s
 *   static middleware, which never runs the hooks — `kit.csp` (see
 *   `svelte.config.js`) bakes a `<meta http-equiv>` policy into their HTML;
 * - server-rendered routes (`/health`, `/signup`) get the real header from
 *   `hooks.server.ts`, alongside the backend-specified security headers;
 * - and a real production build must run with zero
 *   `securitypolicyviolation` events across both locales
 *   (`docs/security/csp-widenings.md`).
 */

async function collectViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const violations: Array<{ directive: string; disposition: string }> = []
    window.addEventListener('securitypolicyviolation', (event) => {
      violations.push({
        directive: event.violatedDirective,
        disposition: event.disposition,
        blocked: (event as SecurityPolicyViolationEvent & { blockedURL?: string }).blockedURL,
        sourceFile: event.sourceFile,
        sample: event.sample,
        statusCode: event.statusCode,
      })
    })
    Object.defineProperty(window, '__cspViolations', { get: () => violations })
  })
}

test('prerendered pages carry the tightened policy as a meta tag', async ({ request }) => {
  const response = await request.get('/')
  expect(response.ok()).toBe(true)
  const body = await response.text()
  // Attribute values are case-insensitive in HTML (kit emits lowercase
  // `http-equiv`), and browsers honour the lowercase form.
  const csp = body.match(
    /<meta[^>]*http-equiv=["']?content-security-policy["']? content="([^"]*)"/i,
  )?.[1]
  expect(csp, 'prerendered HTML must embed the CSP meta').toBeTruthy()
  expect(csp).toContain("default-src 'self'")
  expect(csp).not.toMatch(/style-src '[^']*unsafe-inline/)
})

test('server-rendered routes carry the CSP header and the specified security headers', async ({
  request,
}) => {
  const response = await request.get('/health')
  expect(response.ok()).toBe(true)
  const csp = response.headers()['content-security-policy'] ?? ''
  expect(csp).toContain("default-src 'self'")
  expect(csp).not.toMatch(/style-src '[^']*unsafe-inline/)
  expect(csp).toContain("style-src-attr 'unsafe-inline'")

  expect(response.headers()['x-content-type-options']).toBe('nosniff')
  expect(response.headers()['referrer-policy']).toBe('same-origin')
  expect(response.headers()['x-frame-options']).toBe('DENY')
  expect(response.headers()['permissions-policy']).toBe(
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  )
})

test('zero CSP violations across key routes in both locales', async ({ page }) => {
  await collectViolations(page)
  // `/status` polls the readiness API client-side (TASK-025) — its presence
  // here is what pins the baked `connect-src` to the runtime API origin.
  for (const path of ['/', '/pricing', '/ja/pricing', '/status', '/ja/status']) {
    await page.goto(path)
    await expect(page.locator('body')).toBeVisible()
  }
  const violations = await page.evaluate(
    () => (window as unknown as { __cspViolations: unknown[] }).__cspViolations,
  )
  expect(violations).toEqual([])
})
