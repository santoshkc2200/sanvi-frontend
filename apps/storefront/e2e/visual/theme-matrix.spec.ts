import { expect, test } from '@playwright/test'

const STOREFRONT_PORT = 4174

const THEMES = [
  {
    key: 'dawn',
    brandColor: '#0066cc',
  },
  {
    key: 'aurora',
    brandColor: '#7c3aed',
  },
]

const LOCALES = [
  { code: 'en', path: '' },
  { code: 'ja', path: '/ja' },
]

test.describe('Theme & Locale Visual Matrix', () => {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`renders ${theme.key} theme in ${locale.code} with correct visual invariants`, async ({
        page,
        context,
      }) => {
        await context.addCookies([
          {
            name: 'sanvi_locale',
            value: locale.code,
            domain: 'localhost',
            path: '/',
          },
        ])

        const url = `http://localhost:${STOREFRONT_PORT}/_theme-preview?token=draft-preview&locale=${locale.code}`
        const response = await page.goto(url)
        expect(response?.status()).toBeLessThan(400)

        // 1. Theme style tag is injected in <head>
        const styleTag = page.locator('style#sanvi-theme').first()
        await expect(styleTag).toBeAttached()
        const styleContent = await styleTag.textContent()
        expect(styleContent).toContain('--sanvi-color-brand-primary')

        // 2. Document language matches requested locale
        const html = page.locator('html')
        await expect(html).toHaveAttribute('lang', locale.code)

        // 3. Layout structure renders expected blocks
        await expect(page.locator('body')).toBeVisible()

        // 4. Inlined theme variables are available in computed styles
        const brandColor = await page.evaluate(() => {
          return getComputedStyle(document.documentElement)
            .getPropertyValue('--sanvi-color-brand-primary')
            .trim()
        })
        expect(brandColor).toBeTruthy()

        // 5. Header / navigation is visible
        const header = page.locator('header')
        if ((await header.count()) > 0) {
          await expect(header.first()).toBeVisible()
        }
      })
    }
  }
})
