import { describe, expect, it } from 'vitest'
import {
  ads,
  buildContentSecurityPolicy,
  buildContentSecurityPolicyDirectives,
  buildContentSecurityPolicyDirectivesForApp,
  buildContentSecurityPolicyForApp,
} from '../src/index'

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

  it('folds the theme asset origin into img-src, font-src, and style-src when set', () => {
    const csp = buildContentSecurityPolicy({
      apiOrigin: 'https://api.example.com',
      themeAssetOrigin: 'https://theme-cdn.sanvi.app',
    })
    expect(csp).toContain("img-src 'self' data: blob: https: https://theme-cdn.sanvi.app")
    expect(csp).toContain("font-src 'self' data: https://theme-cdn.sanvi.app")
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://theme-cdn.sanvi.app")
  })

  it('omits theme asset origin when unset', () => {
    const csp = buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com' })
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    expect(csp).not.toContain('theme-cdn')
    expect(csp).toContain("font-src 'self' data:")
  })
})

describe('buildContentSecurityPolicyDirectives', () => {
  it('includes themeAssetOrigin in directives when passed', () => {
    const directives = buildContentSecurityPolicyDirectives({
      apiOrigin: 'https://api.example.com',
      themeAssetOrigin: 'https://theme-cdn.sanvi.app',
    })
    expect(directives['img-src']).toContain('https://theme-cdn.sanvi.app')
    expect(directives['font-src']).toContain('https://theme-cdn.sanvi.app')
    expect(directives['style-src']).toContain('https://theme-cdn.sanvi.app')
  })

  it('omits themeAssetOrigin from directives when absent', () => {
    const directives = buildContentSecurityPolicyDirectives({
      apiOrigin: 'https://api.example.com',
    })
    expect(directives['style-src']).toEqual(["'self'", "'unsafe-inline'"])
    expect(directives['font-src']).toEqual(["'self'", 'data:'])
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
      buildContentSecurityPolicy({ ...options, delivery: 'meta', ads: true }),
    )
  })
})

describe('ads() preset (phase 10)', () => {
  const oauthHosts = ['https://accounts.google.com', 'https://www.facebook.com']
  const previewCdns = ['https://*.googleusercontent.com', 'https://*.fbcdn.net']

  it('adds OAuth handoff origins to connect-src and form-action, and preview CDNs to img-src', () => {
    const preset = ads()
    expect(preset['connect-src']).toEqual(oauthHosts)
    expect(preset['form-action']).toEqual(oauthHosts)
    expect(preset['img-src']).toEqual(previewCdns)
  })

  it('never widens script execution: no script-src/style-src keys, no unsafe-inline/unsafe-eval anywhere', () => {
    const preset = ads()
    expect(preset['script-src']).toBeUndefined()
    expect(preset['style-src']).toBeUndefined()
    for (const sources of Object.values(preset)) {
      for (const source of sources ?? []) {
        expect(source).not.toContain('unsafe-inline')
        expect(source).not.toContain('unsafe-eval')
      }
    }
  })

  it('folds the ad origins into a policy only when the ads option is on', () => {
    const base = { apiOrigin: 'https://api.example.com' }
    const withAds = buildContentSecurityPolicy({ ...base, ads: true })

    expect(withAds).toContain(
      "connect-src 'self' https://api.example.com https://api.stripe.com https://*.stripe.com https://*.link.com https://accounts.google.com https://www.facebook.com",
    )
    expect(withAds).toContain(
      "form-action 'self' https://*.stripe.com https://accounts.google.com https://www.facebook.com",
    )
    expect(withAds).toMatch(
      /img-src[^;]*https:\/\/\*\.googleusercontent\.com[^;]*https:\/\/\*\.fbcdn\.net/,
    )
    // The token endpoints are server-to-server only — never browser-allowed.
    expect(withAds).not.toContain('oauth2.googleapis.com')
    expect(withAds).not.toContain('graph.facebook.com')

    const withoutAds = buildContentSecurityPolicy(base)
    expect(withoutAds).not.toContain('accounts.google.com')
    expect(withoutAds).not.toContain('facebook.com')
    expect(withoutAds).not.toContain('googleusercontent.com')
    expect(withoutAds).not.toContain('fbcdn.net')
  })

  it('admin includes the ads() preset origins and never widens script-src', () => {
    const csp = buildContentSecurityPolicyForApp('admin', { apiOrigin: 'https://api.example.com' })
    expect(csp).toContain('https://accounts.google.com')
    expect(csp).toContain('https://www.facebook.com')
    expect(csp).toContain('https://*.googleusercontent.com')
    expect(csp).toContain('https://*.fbcdn.net')
    // `style-src 'unsafe-inline'` predates this phase (component styles);
    // what must never happen is script-execution widening.
    const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? ''
    expect(scriptSrc).not.toContain('unsafe-inline')
    expect(scriptSrc).not.toContain('unsafe-eval')
  })

  it.each(['marketing', 'storefront', 'platform-admin'] as const)(
    '%s does not include the ads() preset origins',
    (app) => {
      const csp = buildContentSecurityPolicyForApp(app, { apiOrigin: 'https://api.example.com' })
      expect(csp).not.toContain('accounts.google.com')
      expect(csp).not.toContain('facebook.com')
      expect(csp).not.toContain('googleusercontent.com')
      expect(csp).not.toContain('fbcdn.net')
    },
  )

  // Snapshot of the storefront policy with representative deploy-time origins.
  // Advertising must not touch the storefront: its tracking (phase 10, TASK-014)
  // is same-origin by design, so this string is pinned to the phase-09 form and
  // any ads() leak into `storefront` fails this byte comparison.
  const SNAPSHOT_OPTIONS = {
    apiOrigin: 'https://api.example.com',
    mediaOrigin: 'https://media.example.com',
    themeAssetOrigin: 'https://cdn.example.com',
    kratosOrigin: 'https://auth.example.com',
  }

  it('storefront policy is byte-identical to phase 09 (no advertising origins ever)', () => {
    expect(buildContentSecurityPolicyForApp('storefront', SNAPSHOT_OPTIONS)).toBe(
      "default-src 'self'; script-src 'self' https://js.stripe.com https://*.stripe.com; style-src 'self' 'unsafe-inline' https://cdn.example.com; img-src 'self' data: blob: https: https://media.example.com https://cdn.example.com https://*.stripe.com https://i.ytimg.com https://img.youtube.com; media-src 'self' blob: https: https://media.example.com; font-src 'self' data: https://cdn.example.com; frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://*.link.com https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be; connect-src 'self' https://api.example.com https://media.example.com https://auth.example.com https://api.stripe.com https://*.stripe.com https://*.link.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self' https://*.stripe.com; frame-ancestors 'none'",
    )
  })

  it('admin policy snapshot includes the ads() preset origins (byte-pinned)', () => {
    expect(buildContentSecurityPolicyForApp('admin', SNAPSHOT_OPTIONS)).toBe(
      "default-src 'self'; script-src 'self' https://js.stripe.com https://*.stripe.com; style-src 'self' 'unsafe-inline' https://cdn.example.com; img-src 'self' data: blob: https: https://media.example.com https://cdn.example.com https://*.stripe.com https://i.ytimg.com https://img.youtube.com https://*.googleusercontent.com https://*.fbcdn.net; media-src 'self' blob: https: https://media.example.com; font-src 'self' data: https://cdn.example.com; frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://*.link.com https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be; connect-src 'self' https://api.example.com https://media.example.com https://auth.example.com https://api.stripe.com https://*.stripe.com https://*.link.com https://accounts.google.com https://www.facebook.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self' https://*.stripe.com https://accounts.google.com https://www.facebook.com",
    )
  })

  it('directives form agrees with the string form on the ad origins', () => {
    const storefront = buildContentSecurityPolicyDirectivesForApp('storefront', SNAPSHOT_OPTIONS)
    expect(storefront['connect-src']).not.toContain('https://accounts.google.com')
    expect(storefront['form-action']).not.toContain('https://www.facebook.com')

    const admin = buildContentSecurityPolicyDirectivesForApp('admin', SNAPSHOT_OPTIONS)
    expect(admin['connect-src']).toEqual(
      expect.arrayContaining(['https://accounts.google.com', 'https://www.facebook.com']),
    )
    expect(admin['img-src']).toEqual(
      expect.arrayContaining(['https://*.googleusercontent.com', 'https://*.fbcdn.net']),
    )
    expect(admin['form-action']).toEqual(
      expect.arrayContaining(['https://accounts.google.com', 'https://www.facebook.com']),
    )
    expect(admin['script-src']).not.toContain('unsafe-inline')
  })
})
