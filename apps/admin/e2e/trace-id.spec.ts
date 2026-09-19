import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * TASK-020 — the boot-failure screen is an error screen like any other
 * (FR-1106): when the session bootstrap fails with a problem+json 500, the
 * screen shows the backend's trace id, and the one copy-diagnostics action
 * puts release, route, tenant, locale, trace id, and breadcrumbs on the
 * clipboard in one paste.
 *
 * The 500 is answered by a route mock (no backend runs beside the preview);
 * its body follows the backend's problem-details convention, including the
 * `trace_id` the frontend displays.
 */
const PINNED_TRACE_ID = 'abcdef0123456789abcdef0123456789'

async function failBootWithTracedProblem(page: Page): Promise<string[]> {
  const seenTraceparents: string[] = []
  // Registered *after* mockBackend's routes — Playwright consults the last
  // matching route first, so this overrides the happy-path `/me` mock.
  await page.route('**/api/v1/me', (route) => {
    const traceparent = route.request().headers()['traceparent']
    if (traceparent) seenTraceparents.push(traceparent)
    return route.fulfill({
      status: 500,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        trace_id: PINNED_TRACE_ID,
      }),
    })
  })
  return seenTraceparents
}

test('boot failure shows the trace id, and the outbound request carried the convention', async ({
  page,
}) => {
  const seenTraceparents = await failBootWithTracedProblem(page)
  await page.goto('/')

  await expect(
    page.getByText('Could not reach the server. Check your connection and try again.'),
  ).toBeVisible()
  await expect(page.getByText(`Reference: ${PINNED_TRACE_ID}`)).toBeVisible()

  // The frontend half of the convention: the failing request itself carried
  // a well-formed W3C traceparent for the backend to join.
  expect(seenTraceparents.length).toBeGreaterThan(0)
  for (const traceparent of seenTraceparents) {
    expect(traceparent).toMatch(/^00-[\da-f]{32}-[\da-f]{16}-01$/)
  }
})

// Clipboard read-back needs explicit permissions; gated to Chromium because
// WebKit's headless clipboard support is not reliable enough to gate on.
test('copy-diagnostics puts all six fields on the clipboard in one paste', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'clipboard read-back is granted per-context on Chromium')

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await failBootWithTracedProblem(page)
  await page.goto('/')

  const copy = page.getByRole('button', { name: 'Copy diagnostics' })
  await expect(copy).toBeVisible()
  await copy.click()
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible()

  const paste = await page.evaluate(() => navigator.clipboard.readText())
  expect(paste).toMatch(/^release: /m)
  expect(paste).toMatch(/^route: boot$/m)
  expect(paste).toMatch(/^tenant: none$/m)
  expect(paste).toMatch(/^locale: en$/m)
  expect(paste).toMatch(new RegExp(`^trace_id: ${PINNED_TRACE_ID}$`, 'm'))
  expect(paste).toMatch(/^breadcrumbs:$/m)
})

// The happy path still mounts the app — booting against the untouched
// fixture must not have regressed (the 500 rewrite only runs in the specs
// that register it).
test.beforeEach(({ page }) => {
  mockBackend(page)
})
