import { expect, test } from '@playwright/test'
import { mockSpaApi } from '../../../scripts/lib/spa-mock-api.mjs'

test('axe sweep identity reaches protected operator content', async ({ page }) => {
  mockSpaApi(page.context(), 'platform-admin')
  await page.goto('/roles')
  await expect(page.getByRole('heading', { name: 'Roles & permissions' })).toBeVisible()
  await expect(page).toHaveURL(/\/roles$/)
})
