import { describe, expect, it } from 'vitest'
import { themeStyleTag } from '../src/apply'
import type { ResolvedTheme } from '../src/types'

function makeMockTheme(overrides: Partial<ResolvedTheme> = {}): ResolvedTheme {
  return {
    theme_key: 'test-theme',
    theme_version: '1.0.0',
    theme_api: '^1.0.0',
    capabilities: [],
    tokens: {},
    css_vars: ':root{--color-brand:#2563eb;}',
    layouts: {},
    fonts: [],
    theme_assets: { screenshots: [] },
    brand_assets: {},
    revision: 1,
    locale: 'en',
    etag: '"etag-1"',
    ...overrides,
  }
}

describe('themeStyleTag', () => {
  it('returns a style tag containing precompiled css_vars for SSR inlining', () => {
    const mock = makeMockTheme({
      css_vars: ':root{--color-brand:#2563eb;--radius-md:0.5rem;}',
    })
    const tag = themeStyleTag(mock)

    expect(tag).toBe(
      '<style id="sanvi-theme">:root{--color-brand:#2563eb;--radius-md:0.5rem;}</style>',
    )
  })

  it('includes custom_css if provided in the resolved theme', () => {
    const mock = makeMockTheme({
      css_vars: ':root{--color-brand:#2563eb;}',
      custom_css: '.sanvi-theme-scope .custom-banner { display: block; }',
    })
    const tag = themeStyleTag(mock)

    expect(tag).toContain(':root{--color-brand:#2563eb;}')
    expect(tag).toContain('.sanvi-theme-scope .custom-banner { display: block; }')
  })

  it('safely escapes style breakout attempts in css strings', () => {
    const mock = makeMockTheme({
      css_vars: ':root{--malicious:"</style><script>alert(1)</script>";}',
    })
    const tag = themeStyleTag(mock)

    expect(tag).not.toContain('</style><script>')
    expect(tag).toContain('<\\/style><script>')
  })

  it('handles empty or missing theme gracefully', () => {
    const mock = makeMockTheme({ css_vars: '' })
    const tag = themeStyleTag(mock)
    expect(tag).toBe('<style id="sanvi-theme"></style>')
  })
})
