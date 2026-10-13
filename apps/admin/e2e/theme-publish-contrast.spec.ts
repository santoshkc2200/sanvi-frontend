import { expect, test, type Page } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * Publish-time theme contrast rejection (TASK-027 step 6). The backend (and
 * its lab mirror in the storefront mock) rejects a draft that fails WCAG AA
 * with a 400 whose problem carries `fields` naming each failing pair; this
 * spec pins the console side of that handshake: the rejection renders the
 * clear contrast message **plus the failing pairs themselves**, and a
 * passing draft publishes without the error.
 */

function draftWith(overrides: Record<string, { $value: string; $type: string }>) {
  return {
    spec: {
      key: 'dawn',
      version: '1.0.0',
      capabilities: ['tokens', 'layouts'],
      fonts: [],
      layouts: {},
      overridable: [],
    },
    theme: {
      theme_key: 'dawn',
      version: '1.0.0',
      state: 'draft',
      revision: 7,
      token_overrides: overrides,
      layout_overrides: {},
      assets: {},
      custom_css: null,
      updated_at: '2026-10-01T00:00:00Z',
    },
  }
}

const FAILING_DRAFT = draftWith({
  // Gray-on-white body text: ~1.9:1, far below the 4.5:1 text minimum.
  'color.text.primary': { $value: '#c8cdd6', $type: 'color' },
})

const FAILING_PROBLEM = {
  type: 'https://sanvi.app/problems/theme/contrast',
  title: 'Theme contrast validation failed',
  status: 400,
  detail: 'The draft does not meet WCAG AA contrast minimums.',
  fields: [
    {
      field: 'color.text.primary',
      message:
        'color.text.primary (#c8cdd6) on color.background.primary (#ffffff) is 1.86:1, below the 4.5:1 WCAG AA minimum.',
    },
  ],
}

async function mockDraft(page: Page, draft: unknown, publishStatus = 200): Promise<void> {
  // Re-register /me (last matching route wins) with the theming permissions
  // the shared mockBackend omits — /theme/publish sits behind
  // `tenant.theming.publish`.
  page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        user_id: '0190f0d0-0000-7000-8000-000000000001',
        email: 'admin@example.com',
        email_verified: true,
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
        memberships: [
          {
            tenant_id: 'dev-acme',
            tenant_slug: 'acme',
            tenant_name: 'Acme Corporation',
            role_ids: ['owner'],
            status: 'active',
            permissions: ['tenant.theming.read', 'tenant.theming.publish'],
          },
        ],
      },
    }),
  )
  page.route('**/api/v1/tenant/theme/draft', (route) => route.fulfill({ json: draft }))
  page.route('**/api/v1/tenant/theme/publish', (route) =>
    publishStatus === 200
      ? route.fulfill({
          json: { ...draft.theme, state: 'live', revision: draft.theme.revision + 1 },
        })
      : route.fulfill({ status: publishStatus, json: FAILING_PROBLEM }),
  )
}

test.describe('Theme publish contrast rejection (11.8)', () => {
  test.beforeEach(async ({ page }) => {
    mockBackend(page)
  })

  test('a failing draft is rejected at publish with the failing pairs named', async ({ page }) => {
    await mockDraft(page, FAILING_DRAFT, 400)
    await page.goto('/theme/publish')

    await page.getByRole('button', { name: 'Publish Changes' }).click()

    // The clear message and *why*: the failing pair with its ratio, not a
    // bare "something failed".
    await expect(page.getByText(/color contrast requirements not met/i)).toBeVisible()
    await expect(page.getByText(/1\.86:1, below the 4\.5:1 WCAG AA minimum/)).toBeVisible()
    // The draft stays a draft — nothing was published.
    await expect(page.getByText('draft', { exact: true })).toBeVisible()
  })

  test('a passing draft publishes without the contrast error', async ({ page }) => {
    await mockDraft(page, draftWith({}), 200)
    await page.goto('/theme/publish')

    await page.getByRole('button', { name: 'Publish Changes' }).click()

    await expect(page.getByText(/color contrast requirements not met/i)).toHaveCount(0)
  })
})
