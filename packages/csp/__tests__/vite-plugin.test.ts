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
})
