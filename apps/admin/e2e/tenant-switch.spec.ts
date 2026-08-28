import { expect, test } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * Since phase 03 the switcher lists the *session's* real memberships, so
 * this suite boots against the mocked `/me` in `mock-backend.ts` (same
 * dev-acme/dev-globex fixtures the assertions already used). `@sanvi/query`'s
 * cache-key tenant-scoping is unit-tested in
 * `packages/query/__tests__/cache.test.ts`, and the switch actually clearing
 * the cache is unit-tested in `apps/admin/__tests__/App.test.ts`. This suite
 * covers what's real and browser-only: the switcher UI and its cookie-backed
 * persistence across a reload.
 */
test.describe('tenant switcher', () => {
  test.beforeEach(async ({ page }) => {
    mockBackend(page)
  })

  test('lists the dev membership list, defaulting to the first membership', async ({ page }) => {
    await page.goto('/')
    const select = page.getByRole('combobox', { name: 'Switch tenant' })
    await expect(select).toHaveValue('dev-acme')
    await expect(page.getByRole('option', { name: 'Acme Corporation' })).toBeAttached()
    await expect(page.getByRole('option', { name: 'Globex Industries' })).toBeAttached()
  })

  test('switching tenants updates the selection and persists it across a reload', async ({
    page,
  }) => {
    await page.goto('/')
    const select = page.getByRole('combobox', { name: 'Switch tenant' })

    await select.selectOption('dev-globex')
    await expect(select).toHaveValue('dev-globex')

    const cookies = await page.context().cookies()
    const tenantCookie = cookies.find((cookie) => cookie.name === 'sanvi_tenant')
    expect(tenantCookie?.value).toBe('dev-globex')

    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Switch tenant' })).toHaveValue('dev-globex')
  })
})
