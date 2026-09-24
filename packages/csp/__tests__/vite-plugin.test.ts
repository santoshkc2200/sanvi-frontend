import { describe, expect, it } from 'vitest'
import { sanviCspMetaPlugin } from '../src/vite-plugin'

function transform(html: string) {
  const plugin = sanviCspMetaPlugin('admin', { apiOrigin: 'https://api.example.com' })
  const hook = plugin.transformIndexHtml as (html: string) => string
  return hook(html)
}

describe('sanviCspMetaPlugin', () => {
  it('injects a CSP meta tag before </head>', () => {
    const result = transform('<html><head><title>Admin</title></head><body></body></html>')
    expect(result).toContain('<meta http-equiv="Content-Security-Policy"')
    expect(result.indexOf('<meta http-equiv="Content-Security-Policy"')).toBeLessThan(
      result.indexOf('</head>'),
    )
  })

  it('omits frame-ancestors — the meta-delivered app CSP', () => {
    const result = transform('<html><head></head><body></body></html>')
    expect(result).not.toContain('frame-ancestors')
  })

  it('produces a single well-formed meta tag containing the api origin', () => {
    const result = transform('<html><head></head><body></body></html>')
    const metaTag = result.match(/<meta http-equiv="Content-Security-Policy" content="([\s\S]*?)">/)
    expect(metaTag).not.toBeNull()
    expect(metaTag?.[1]).toContain('https://api.example.com')
    expect((result.match(/<meta http-equiv="Content-Security-Policy"/g) ?? []).length).toBe(1)
  })

  it('throws when there is no </head> to inject into — never silently skips the CSP', () => {
    expect(() => transform('<html><body></body></html>')).toThrow(/no <\/head> found/)
  })

  /**
   * TASK-024: `devInlineStyles` is the one, explicitly-dev-only inline-style
   * allowance (vite dev injects component CSS as runtime `<style>` nodes).
   * It must default to off so a production config that forgets the flag
   * gets the strict policy, and the flag must touch `style-src` only.
   */
  it('devInlineStyles defaults to a strict style-src', () => {
    const result = transform('<html><head></head><body></body></html>')
    expect(result).toContain('style-src')
    // The recorded style-src-attr exception is present in every policy; the
    // dev flag must be the only thing adding element-level inline styles.
    expect(result).toContain("style-src-attr 'unsafe-inline'")
    expect(result).toMatch(/style-src 'self'(?!-attr)[^;]*(;|$)/)
    expect(result).not.toMatch(/style-src '[^']*unsafe-inline/)
  })

  it('devInlineStyles adds unsafe-inline to style-src only', () => {
    const plugin = sanviCspMetaPlugin(
      'admin',
      { apiOrigin: 'https://api.example.com' },
      { devInlineStyles: true },
    )
    const hook = plugin.transformIndexHtml as (html: string) => string
    const result = hook('<html><head></head><body></body></html>')
    const content = result.match(
      /<meta http-equiv="Content-Security-Policy" content="([\s\S]*?)">/,
    )?.[1]
    expect(content).toContain("style-src 'unsafe-inline'")
    expect(content).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(content).not.toMatch(/script-src[^;]*unsafe-eval/)
  })
})
