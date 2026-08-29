import { themeStyleTag } from '@sanvi/theme-runtime'
import type { ResolvedTheme } from '@sanvi/theme-runtime'
import { describe, expect, it } from 'vitest'

/**
 * Shared custom-CSS sanitiser fixture corpus from `sanvi-backend`
 * (crates/contexts/theming/src/domain/sanitizer.rs).
 */
export const SHARED_CSS_SECURITY_FIXTURES = [
  '<script>alert(1)</script>',
  'body { background: url(javascript:alert(1)); }',
  '@import url(https://evil.example/x.css);',
  'body { background: url(https://evil.example/x.png); }',
  'body { width: expression(alert(1)); }',
  'body { -moz-binding: url(http://evil/xbl.xml); }',
  'body { behavior: url(#default#time2); }',
  'body { background-image: url(data:text/html;base64,PHNjcmlwdD4=); }',
  'body { color: red\\0A }',
  '</style><script>alert(1)</script><style>',
  'body { font-size: 1rem; } } body { color: red',
  'script { color: red; }',
  "body { content: 'hello'; }",
  'body { custom-property: 1; }',
  'a[href="https://evil.example"] { color: red; }',
  "body::before { content: 'phish'; }",
  'body { color: rgb(1,2; background: red; }',
]

function makeThemeWithCustomCss(customCss: string): ResolvedTheme {
  return {
    theme_key: 'dawn',
    theme_version: '1.0.0',
    theme_api: '^1.0.0',
    capabilities: [],
    tokens: {},
    css_vars: ':root{--test:1;}',
    custom_css: customCss,
    layouts: {},
    fonts: [],
    theme_assets: { screenshots: [] },
    brand_assets: {},
    revision: 1,
    locale: 'en',
    etag: '"etag-1"',
  }
}

describe('Custom CSS Security Fixtures', () => {
  it('safely encapsulates all backend security fixture payloads inside style tag without breaking out', () => {
    for (const fixture of SHARED_CSS_SECURITY_FIXTURES) {
      const theme = makeThemeWithCustomCss(fixture)
      const tag = themeStyleTag(theme)

      // Must strictly be enclosed in <style id="sanvi-theme">...</style>
      expect(tag.startsWith('<style id="sanvi-theme">')).toBe(true)
      expect(tag.endsWith('</style>')).toBe(true)

      // Must never contain unescaped closing style tag that breaks out into executable HTML
      const inner = tag.slice('<style id="sanvi-theme">'.length, -'</style>'.length)
      expect(inner).not.toContain('</style>')
      expect(inner).not.toContain('<!--')

      // Assert that when parsed in DOM, no script tags or extra DOM elements are injected
      const parser = new DOMParser()
      const doc = parser.parseFromString(tag, 'text/html')
      const scripts = doc.querySelectorAll('script')
      expect(scripts.length).toBe(0)
    }
  })
})
