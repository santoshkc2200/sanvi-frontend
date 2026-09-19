import { expect, test } from '@playwright/test'

/**
 * TASK-020 — the trace id crosses the repository boundary (FR-1106):
 *
 *   the SSR document, the API response, and the client-side diagnostics
 *   paste all carry **one** trace id.
 *
 * The mock API fails `/api/v1/public/privacy/metrics` when the
 * `mock_trace_fail` cookie is set — with the backend's conventions: a
 * problem body carrying `trace_id` and a `traceparent` response header
 * naming the same trace — so the chain is assertable end to end against a
 * hermetic fixture. The cookie is set per-test context (the SSR load
 * forwards the caller's cookies upstream, BFF-style), and the
 * request-metrics page degrades to its labelled-unavailable state (that
 * design stands) and attaches the correlation id plus the
 * copy-diagnostics action to it.
 */

const HOST = 'http://localhost:4174'
const PATH = '/legal/request-metrics'
const PINNED_TRACE_ID = 'abcdef0123456789abcdef0123456789'

async function failMetricsWithTracedProblem(page: import('@playwright/test').Page): Promise<void> {
  await page.context().addCookies([{ name: 'mock_trace_fail', value: '1', url: HOST }])
}

async function fetchLog(page: import('@playwright/test').Page) {
  const response = await page.request.get('http://localhost:8090/__privacy/log')
  return response.json() as Promise<{ method: string; path: string; traceparent: string | null }[]>
}

test.beforeEach(async ({ page }) => {
  await failMetricsWithTracedProblem(page)
})

test('the SSR document, the API response, and the request all name one trace', async ({ page }) => {
  // `page.request`, not a bare request fixture: it shares the context's
  // cookies, and with no browser involved whatever HTML comes back is the
  // *server's* render.
  const ssr = await page.request.get(`${HOST}${PATH}`)
  expect(ssr.status()).toBe(200) // the page degrades; the failure is the metrics call's
  const html = await ssr.text()
  expect(html).toContain(`Reference: ${PINNED_TRACE_ID}`)

  // After hydration the same facts render, and the copy action is present.
  await page.goto(`${HOST}${PATH}`)
  await expect(page.getByText(`Reference: ${PINNED_TRACE_ID}`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy diagnostics' })).toBeVisible()
})

test('the SSR request to the API carried a well-formed traceparent (the client sent the convention)', async ({
  page,
}) => {
  await page.goto(`${HOST}${PATH}`)

  const metricsCalls = (await fetchLog(page)).filter((entry) =>
    entry.path.startsWith('/api/v1/public/privacy/metrics'),
  )
  expect(metricsCalls.length).toBeGreaterThan(0)
  for (const call of metricsCalls) {
    // `00-<32 hex>-<16 hex>-01` — what the backend needs to join the trace.
    expect(call.traceparent).toMatch(/^00-[\da-f]{32}-[\da-f]{16}-01$/)
  }
})

// Clipboard read-back needs explicit permissions, granted here for Chromium;
// WebKit's headless clipboard support is not reliable enough to gate on.
test('copy-diagnostics puts release, route, tenant, locale, trace id, and breadcrumbs on the clipboard in one paste', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'clipboard read-back is not reliably grantable on WebKit')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

  await page.goto(`${HOST}${PATH}`)
  await page.getByRole('button', { name: 'Copy diagnostics' }).click()

  const paste = await page.evaluate(() => navigator.clipboard.readText())
  // All six FR-1106 fields, and the trace id is the one the API returned.
  expect(paste).toMatch(/^release: /m)
  expect(paste).toMatch(/^route: \/legal\/request-metrics$/m)
  expect(paste).toMatch(/^tenant: none$/m)
  expect(paste).toMatch(/^locale: en$/m)
  expect(paste).toMatch(new RegExp(`^trace_id: ${PINNED_TRACE_ID}$`, 'm'))
  expect(paste).toMatch(/^breadcrumbs:$/m)
})
