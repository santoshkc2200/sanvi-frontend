import { expect, test } from '@playwright/test'

const MOCK_API_PORT = 8090
const STOREFRONT_PORT = 4174

test.describe('Theme change, preview, publish, and rollback flow', () => {
  test('change a brand colour → preview shows it → publish → storefront reflects it on next request → rollback restores it', async ({
    page,
    request,
  }, testInfo) => {
    const host = `${testInfo.project.name}.localhost:${STOREFRONT_PORT}`
    const tenantIdMap: Record<string, string> = {
      chromium: '44444444-4444-4444-4444-444444444444',
      webkit: '55555555-5555-5555-5555-555555555555',
      'mobile-chrome': '66666666-6666-6666-6666-666666666666',
    }
    const tenantId = tenantIdMap[testInfo.project.name] || '11111111-1111-1111-1111-111111111111'
    const headers = { 'x-tenant-id': tenantId, host }

    // Two 30s+ cache-expiry waits below (see comments) push this well past
    // Playwright's default 30s test timeout.
    test.setTimeout(120_000)

    // Reset mock backend theme state for this host
    await request.post(`http://localhost:${MOCK_API_PORT}/__theme/reset`, { headers })

    // 1. Storefront initial render: live brand color is #0066cc
    const initialRes = await page.goto(`http://${host}/`)
    expect(initialRes?.status()).toBeLessThan(400)
    const initialHtml = await page.content()
    expect(initialHtml).toContain('--sanvi-color-brand-primary: #0066cc')

    // 2. Change brand colour in tenant draft
    const draftUpdateRes = await request.put(
      `http://localhost:${MOCK_API_PORT}/api/v1/tenant/theme/draft`,
      {
        headers,
        data: {
          token_overrides: {
            'color.brand.primary': { $value: '#ff5500' },
          },
        },
      },
    )
    expect(draftUpdateRes.ok()).toBe(true)

    // 3. Preview shows the changed draft color in isolated preview route
    const previewRes = await page.goto(`http://${host}/_theme-preview?token=draft-preview`)
    expect(previewRes?.status()).toBeLessThan(400)
    expect(previewRes?.headers()['x-robots-tag']).toContain('noindex')
    const previewHtml = await page.content()
    expect(previewHtml).toContain('--sanvi-color-brand-primary: #ff5500')

    // 4. Storefront live before publish still shows original color
    const beforePublishRes = await page.goto(`http://${host}/`)
    expect(beforePublishRes?.status()).toBeLessThan(400)
    const beforePublishHtml = await page.content()
    expect(beforePublishHtml).toContain('--sanvi-color-brand-primary: #0066cc')

    // 5. Publish theme
    const publishRes = await request.post(
      `http://localhost:${MOCK_API_PORT}/api/v1/tenant/theme/publish`,
      { headers },
    )
    expect(publishRes.ok()).toBe(true)

    // `resolveTheme`'s cache has no direct invalidation channel from a
    // publish (the admin app talks to the backend, not to this running
    // storefront process) — staleness is bounded by the shared
    // `themeCache`'s 30s TTL instead. Waiting it out here, rather than
    // shortening the production default to fit the test, keeps this
    // assertion honest about actual publish-to-storefront latency.
    await new Promise((resolve) => setTimeout(resolve, 30_500))

    // 6. Storefront on next request reflects the published color
    const afterPublishRes = await page.goto(`http://${host}/`)
    expect(afterPublishRes?.status()).toBeLessThan(400)
    const afterPublishHtml = await page.content()
    expect(afterPublishHtml).toContain('--sanvi-color-brand-primary: #ff5500')

    // 7. Rollback theme
    const rollbackRes = await request.post(
      `http://localhost:${MOCK_API_PORT}/api/v1/tenant/theme/rollback`,
      { headers },
    )
    expect(rollbackRes.ok()).toBe(true)

    // Same cache-expiry wait as above, this time for the rollback.
    await new Promise((resolve) => setTimeout(resolve, 30_500))

    // 8. Storefront on next request restores previous appearance exactly
    const afterRollbackRes = await page.goto(`http://${host}/`)
    expect(afterRollbackRes?.status()).toBeLessThan(400)
    const afterRollbackHtml = await page.content()
    expect(afterRollbackHtml).toContain('--sanvi-color-brand-primary: #0066cc')
  })
})
