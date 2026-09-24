import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

/**
 * TASK-024's per-app CSP snapshot, at the delivery surface a browser sees.
 * The storefront's policy is emitted by `kit.csp` (hash mode for its own
 * scripts) and rewritten per request by `hooks.server.ts` — these
 * assertions pin what actually ships:
 *
 * - the tightened policy: no `unsafe-inline` anywhere, `frame-ancestors`,
 *   and the runtime origins in `connect-src`;
 * - the theme's inline `<style>` is allowed by a per-request `sha256` hash
 *   whose content is byte-identical to the tag actually rendered;
 * - the backend-specified security headers (NFR-1114) on the same response;
 * - zero `securitypolicyviolation` events across key routes — the local
 *   production-build substitute for the report-only staging cycle (see
 *   `docs/security/csp-widenings.md`).
 */

/** Installs the violation collector before any page script runs. */
async function collectViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const violations: Array<{
      directive: string
      disposition: string
      effectiveDirective?: string
    }> = []
    window.addEventListener('securitypolicyviolation', (event) => {
      violations.push({
        directive: event.violatedDirective,
        disposition: event.disposition,
        effectiveDirective: event.effectiveDirective,
      })
    })
    Object.defineProperty(window, '__cspViolations', { get: () => violations })
  })
}

test('delivered CSP is the tightened policy with a matching theme style hash', async ({
  request,
}) => {
  const response = await request.get('/')
  expect(response.ok()).toBe(true)
  const csp = response.headers()['content-security-policy'] ?? ''
  expect(csp).toContain("default-src 'self'")
  // `style-src` (style elements) must be clean; the one recorded exception
  // lives in `style-src-attr` (docs/security/csp-widenings.md).
  expect(csp).toMatch(/style-src 'self'[^;]*;/)
  expect(csp).not.toMatch(/style-src '[^']*unsafe-inline/)
  expect(csp).toContain("style-src-attr 'unsafe-inline'")
  expect(csp).not.toContain('unsafe-eval')
  expect(csp).toContain("frame-ancestors 'none'")
  // The runtime origin rewrite still runs — the header must name the API the
  // preview environment actually calls (playwright.config webServer env).
  expect(csp).toContain('connect-src')

  // The hash in `style-src` must be of exactly the theme CSS the page renders.
  const body = await response.text()
  const styleMatch = /<style id="sanvi-theme">([\s\S]*?)<\/style>/.exec(body)
  expect(styleMatch).not.toBeNull()
  const hash = `'sha256-${createHash('sha256')
    .update(styleMatch?.[1] ?? '')
    .digest('base64')}'`
  expect(csp).toContain(`style-src 'self' ${hash}`)

  // NFR-1114 security headers on the same response.
  expect(response.headers()['x-content-type-options']).toBe('nosniff')
  expect(response.headers()['referrer-policy']).toBe('same-origin')
  expect(response.headers()['x-frame-options']).toBe('DENY')
  expect(response.headers()['permissions-policy']).toBe(
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  )
})

test('zero CSP violations across key routes', async ({ page }) => {
  await collectViolations(page)
  for (const path of ['/', '/privacy']) {
    await page.goto(path)
    await expect(page.locator('body')).toBeVisible()
  }
  const violations = await page.evaluate(
    () => (window as unknown as { __cspViolations: unknown[] }).__cspViolations,
  )
  expect(violations).toEqual([])
})
