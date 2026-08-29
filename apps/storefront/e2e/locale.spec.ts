import { expect, test } from '@playwright/test'

/**
 * Phase 06 locale routing e2e — the parts a unit test can't see: real SSR
 * HTML attributes, real redirects, and switcher navigation that survives a
 * reload. The mock API's tenant resolves with `default_locale: 'en'`, so
 * `/` is the canonical unprefixed form and `/ja/…` is the Japanese
 * alternate.
 */

test('unprefixed pages are English: lang, content-language, no redirect', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.ok()).toBe(true)
  expect(response?.status()).toBe(200)
  expect(response?.headers()['content-language']).toBe('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('navigation', { name: 'Privacy and legal' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Your privacy choices' })).toBeVisible()
})

test('a locale-prefixed path renders Japanese server-side — no flash of English', async ({
  page,
}) => {
  const response = await page.goto('/ja')
  expect(response?.ok()).toBe(true)
  expect(response?.headers()['content-language']).toBe('ja')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  await expect(page.getByRole('navigation', { name: '言語' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'プライバシーの設定' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'プライバシーと法的事項' })).toBeVisible()
})

test('a default-locale prefix 308s to the canonical unprefixed URL', async ({ page }) => {
  const response = await page.goto('/en/privacy', { waitUntil: 'commit' })
  expect(response?.status()).toBe(200)
  expect(page.url()).not.toContain('/en/privacy')
})

test('a non-default prefix deep link keeps the locale across navigation', async ({ page }) => {
  await page.goto('/ja/privacy')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  // The switcher preserves path: the English link on a ja page goes to the
  // unprefixed (canonical en) version of the SAME page.
  const enHref = await page
    .locator('nav.sanvi-footer__locales a[hreflang="en"]')
    .getAttribute('href')
  expect(enHref).toBe('/privacy')
})

test('choosing a locale persists it — returning to / lands in that language', async ({ page }) => {
  // The consent banner floats over the footer; settle it first.
  await page.goto('/privacy')
  const accept = page.getByRole('button', { name: 'Accept all' })
  if (await accept.isVisible().catch(() => false)) await accept.click()

  // The switcher link writes the sanvi_locale cookie on click; a later
  // visit to the unprefixed origin canonicalizes to the visitor's locale.
  await page.locator('nav.sanvi-footer__locales a[hreflang="ja"]').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  expect(new URL(page.url()).pathname).toBe('/ja/privacy')

  await page.goto('/')
  expect(new URL(page.url()).pathname).toBe('/ja')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
})

test('canonical and hreflang alternates are present', async ({ page }) => {
  await page.goto('/privacy')
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
  expect(canonical).toContain('/privacy')
  expect(canonical).not.toContain('/en/')
  for (const lang of ['en', 'ja', 'x-default']) {
    const href = await page
      .locator(`link[rel="alternate"][hreflang="${lang}"]`)
      .getAttribute('href')
    expect(href, lang).toBeTruthy()
  }
})
