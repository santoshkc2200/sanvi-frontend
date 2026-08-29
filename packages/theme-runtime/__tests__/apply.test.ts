import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, parseCssVars, theme } from '../src/apply'
import type { ResolvedTheme } from '../src/types'

function makeMockTheme(overrides: Partial<ResolvedTheme> = {}): ResolvedTheme {
  return {
    theme_key: 'test-theme',
    theme_version: '1.0.0',
    theme_api: '^1.0.0',
    capabilities: ['dark-mode'],
    tokens: {},
    css_vars:
      ':root{--color-brand-primary:#2563eb;--radius-md:0.5rem;}@media (prefers-color-scheme: dark){:root{--color-brand-primary:#60a5fa;}}',
    layouts: {},
    fonts: [],
    theme_assets: { screenshots: [] },
    brand_assets: {},
    revision: 1,
    locale: 'en',
    etag: '"etag-test-1"',
    ...overrides,
  }
}

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark', 'light')
  })

  afterEach(() => {
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark', 'light')
  })

  it('updates the readable theme store', () => {
    const mock = makeMockTheme({ theme_key: 'aurora', revision: 5 })
    applyTheme(mock)
    expect(get(theme)).toEqual(mock)
  })

  it('applies CSS custom properties to document.documentElement in light mode', () => {
    const mock = makeMockTheme({
      css_vars: ':root{--color-bg:#ffffff;--color-text:#000000;--spacing-unit:8px;}',
    })
    applyTheme(mock)

    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('#ffffff')
    expect(document.documentElement.style.getPropertyValue('--color-text')).toBe('#000000')
    expect(document.documentElement.style.getPropertyValue('--spacing-unit')).toBe('8px')
  })

  it('removes stale CSS custom properties when switching themes', () => {
    const themeA = makeMockTheme({
      css_vars: ':root{--color-bg:#ffffff;--color-old:#111111;}',
    })
    applyTheme(themeA)
    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('#ffffff')
    expect(document.documentElement.style.getPropertyValue('--color-old')).toBe('#111111')

    const themeB = makeMockTheme({
      css_vars: ':root{--color-bg:#f3f4f6;--color-new:#222222;}',
    })
    applyTheme(themeB)

    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('#f3f4f6')
    expect(document.documentElement.style.getPropertyValue('--color-new')).toBe('#222222')
    expect(document.documentElement.style.getPropertyValue('--color-old')).toBe('')
  })

  it('applies dark tokens when data-theme="dark" override is set', () => {
    document.documentElement.setAttribute('data-theme', 'dark')

    const mock = makeMockTheme({
      css_vars:
        ':root{--color-bg:#ffffff;--color-brand:#2563eb;}@media (prefers-color-scheme: dark){:root{--color-bg:#0f172a;--color-brand:#38bdf8;}}',
    })
    applyTheme(mock)

    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('#0f172a')
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe('#38bdf8')
  })

  it('applies dark tokens when class="dark" is present', () => {
    document.documentElement.classList.add('dark')

    const mock = makeMockTheme({
      css_vars:
        ':root{--color-bg:#ffffff;}@media (prefers-color-scheme: dark){:root{--color-bg:#121212;}}',
    })
    applyTheme(mock)

    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('#121212')
  })

  it('forces light tokens when data-theme="light" even if system prefers dark', () => {
    document.documentElement.setAttribute('data-theme', 'light')

    const mock = makeMockTheme({
      css_vars:
        ':root{--color-bg:#ffffff;}@media (prefers-color-scheme: dark){:root{--color-bg:#000000;}}',
    })
    applyTheme(mock)

    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('#ffffff')
  })

  it('correctly parses complex CSS variable blocks with whitespace and formatting', () => {
    const rawCss = `
      :root {
        --color-primary: #3b82f6;
        --radius-lg: 12px;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --color-primary: #60a5fa;
        }
      }
    `
    const parsed = parseCssVars(rawCss)
    expect(parsed.light['--color-primary']).toBe('#3b82f6')
    expect(parsed.light['--radius-lg']).toBe('12px')
    expect(parsed.dark['--color-primary']).toBe('#60a5fa')
  })
})
