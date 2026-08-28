import type { Page } from '@playwright/test'

/**
 * Sets the mock privacy context for one test: a jurisdiction (whose profile
 * decides the consent model) and a UNIQUE device reference. The device
 * cookie matters: on a *first* visit the browser has none, and the mock
 * would bucket every parallel worker under one anonymous subject — a real
 * deployment has the same first-visit gap, and the e2e suite models the
 * interesting case, the returning device, where decisions stick.
 */
export async function setPrivacyContext(
  page: Page,
  options: { jurisdiction?: 'eu' | 'us-ca' } = {},
): Promise<void> {
  const cookies: { name: string; value: string; url: string }[] = [
    {
      name: 'sanvi_device',
      value: `e2e-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
      url: 'http://localhost:4174',
    },
  ]
  if (options.jurisdiction) {
    cookies.push({
      name: 'mock_jurisdiction',
      value: options.jurisdiction,
      url: 'http://localhost:4174',
    })
  }
  await page.context().addCookies(cookies)
}
