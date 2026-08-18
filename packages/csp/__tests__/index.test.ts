import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy, buildContentSecurityPolicyForApp } from '../src/index'

describe('buildContentSecurityPolicy', () => {
  it('includes the api origin in connect-src', () => {
    const csp = buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com' })
    expect(csp).toContain("connect-src 'self' https://api.example.com")
  })

  it('omits unsafe-inline and unsafe-eval from script-src by default', () => {
    const csp = buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com' })
    expect(csp).toContain("script-src 'self' https://js.stripe.com https://*.stripe.com")
    expect(csp).not.toContain('unsafe-eval')
  })

  it('adds unsafe-inline and unsafe-eval when requested', () => {
    const csp = buildContentSecurityPolicy({
      apiOrigin: 'https://api.example.com',
      allowInlineScripts: true,
      allowEval: true,
    })
    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com",
    )
  })

  it('folds the media origin into img-src, media-src, and connect-src when set', () => {
    const csp = buildContentSecurityPolicy({
      apiOrigin: 'https://api.example.com',
      mediaOrigin: 'http://localhost:9000',
    })
    expect(csp).toContain("img-src 'self' data: blob: https: http://localhost:9000")
    expect(csp).toContain("media-src 'self' blob: https: http://localhost:9000")
    expect(csp).toContain("connect-src 'self' https://api.example.com http://localhost:9000")
  })

  it('folds the kratos origin into connect-src only, not img-src/media-src', () => {
    const csp = buildContentSecurityPolicy({
      apiOrigin: 'https://api.example.com',
      kratosOrigin: 'https://auth.example.com',
    })
    expect(csp).toContain("connect-src 'self' https://api.example.com https://auth.example.com")
    expect(csp).not.toMatch(/img-src[^;]*auth\.example\.com/)
    expect(csp).not.toMatch(/media-src[^;]*auth\.example\.com/)
  })

  it('drops the media origin cleanly when unset', () => {
    const csp = buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com' })
    expect(csp).toContain("img-src 'self' data: blob: https: https://*.stripe.com")
    expect(csp).toContain("media-src 'self' blob: https:;")
    expect(csp).not.toMatch(/media-src[^;]*localhost/)
  })

  it('always allows the youtube-nocookie embed frame', () => {
    const csp = buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com' })
    expect(csp).toContain('https://www.youtube-nocookie.com')
  })

  it('keeps frame-ancestors for header delivery, the default', () => {
    const csp = buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com' })
    expect(csp).toContain("frame-ancestors 'none'")
    expect(
      buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com', delivery: 'header' }),
    ).toBe(csp)
  })

  it('drops frame-ancestors for meta delivery, where browsers ignore it', () => {
    const csp = buildContentSecurityPolicy({
      apiOrigin: 'https://api.example.com',
      delivery: 'meta',
    })
    expect(csp).not.toContain('frame-ancestors')
    expect(csp.endsWith("form-action 'self' https://*.stripe.com")).toBe(true)
  })

  it('joins directives with "; " and has no trailing separator', () => {
    const csp = buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com' })
    expect(csp.endsWith(';')).toBe(false)
    expect(csp.split('; ').every((part) => part.length > 0)).toBe(true)
  })
})

describe('buildContentSecurityPolicyForApp', () => {
  const options = { apiOrigin: 'https://api.example.com' }

  it.each(['marketing', 'storefront'] as const)(
    '%s keeps frame-ancestors (header delivery)',
    (app) => {
      const csp = buildContentSecurityPolicyForApp(app, options)
      expect(csp).toContain("frame-ancestors 'none'")
    },
  )

  it.each(['admin', 'platform-admin'] as const)(
    '%s drops frame-ancestors (meta delivery)',
    (app) => {
      const csp = buildContentSecurityPolicyForApp(app, options)
      expect(csp).not.toContain('frame-ancestors')
    },
  )

  it('every preset matches buildContentSecurityPolicy with the same explicit options', () => {
    expect(buildContentSecurityPolicyForApp('marketing', options)).toBe(
      buildContentSecurityPolicy({ ...options, delivery: 'header' }),
    )
    expect(buildContentSecurityPolicyForApp('admin', options)).toBe(
      buildContentSecurityPolicy({ ...options, delivery: 'meta' }),
    )
  })
})
