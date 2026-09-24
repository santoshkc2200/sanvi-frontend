import { describe, expect, it } from 'vitest'
import {
  ads,
  buildContentSecurityPolicy,
  buildContentSecurityPolicyDirectives,
  buildContentSecurityPolicyDirectivesForApp,
  buildContentSecurityPolicyForApp,
  type SanviApp,
} from '../src/index'

/**
 * TASK-024 removed the inline-style allowance from `style-src` and narrowed
 * the ads preset to its creative-preview `img-src` origins — the full
 * accounting lives in `docs/security/csp-widenings.md`. The byte-pinned
 * snapshots below are the per-app CSP snapshot tests the task's DoD asks
 * for: any policy change is a reviewed diff, and any reintroduction of
 * `unsafe-inline` fails here.
 */
describe('buildContentSecurityPolicy', () => {
  it('includes the api origin in connect-src', () => {
    const csp = buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com' })
    expect(csp).toContain("connect-src 'self' https://api.example.com")
  })

  it('script-src allows only self and Stripe — no inline, no eval, ever', () => {
    const csp = buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com' })
    expect(csp).toContain("script-src 'self' https://js.stripe.com https://*.stripe.com")
    expect(csp).not.toContain('unsafe-eval')
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
    expect(csp).toContain("style-src 'self' https://theme-cdn.sanvi.app")
  })

  it('omits theme asset origin when unset', () => {
    const csp = buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com' })
    expect(csp).toContain("style-src 'self'; style-src-attr 'unsafe-inline';")
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
    expect(directives['style-src']).toEqual(["'self'"])
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

  /**
   * The TASK-024 headline invariant: no app's policy may contain
   * `unsafe-inline` or `unsafe-eval` in any directive. The dev-only style
   * exception lives at the dev *call sites* (see
   * `docs/security/csp-widenings.md`), never in the presets — so anything
   * that reaches a build is caught here.
   */
  it.each(['marketing', 'storefront', 'admin', 'platform-admin'] as const)(
    '%s: no unsafe-inline and no unsafe-eval anywhere in the policy',
    (app: SanviApp) => {
      const csp = buildContentSecurityPolicyForApp(app, {
        apiOrigin: 'https://api.example.com',
        mediaOrigin: 'https://media.example.com',
        themeAssetOrigin: 'https://cdn.example.com',
        kratosOrigin: 'https://auth.example.com',
      })
      // `style-src` (style *elements* — the exfiltration-capable vector) and
      // `script-src` must be clean; the one recorded `unsafe-inline` lives in
      // `style-src-attr` (see docs/security/csp-widenings.md for why Svelte
      // SSR's style attributes cannot be enumerated).
      const styleSrc = /style-src ([^;]+)/.exec(csp)?.[1] ?? ''
      expect(styleSrc).not.toContain('unsafe-inline')
      expect(csp).toContain("style-src-attr 'unsafe-inline'")
      expect(csp).not.toContain('unsafe-eval')

      const directives = buildContentSecurityPolicyDirectivesForApp(app, {
        apiOrigin: 'https://api.example.com',
        mediaOrigin: 'https://media.example.com',
        themeAssetOrigin: 'https://cdn.example.com',
        kratosOrigin: 'https://auth.example.com',
      })
      for (const [name, sources] of Object.entries(directives)) {
        // The recorded exception — every other directive must be clean.
        if (name === 'style-src-attr') continue
        for (const source of sources) {
          expect(source, `${app} ${name}`).not.toContain('unsafe-inline')
          expect(source, `${app} ${name}`).not.toContain('unsafe-eval')
        }
      }
    },
  )
})

describe('ads() preset (phase 10, narrowed in TASK-024)', () => {
  const previewCdns = ['https://*.googleusercontent.com', 'https://*.fbcdn.net']

  it('carries only the creative-preview CDNs — no OAuth handoff origins', () => {
    const preset = ads()
    expect(preset['img-src']).toEqual(previewCdns)
    // The handoff is a top-level navigation (CSP does not govern it) and
    // token exchange is server-to-server, so these were speculative:
    expect(preset['connect-src']).toBeUndefined()
    expect(preset['form-action']).toBeUndefined()
    expect(preset['script-src']).toBeUndefined()
    expect(preset['style-src']).toBeUndefined()
  })

  it('folds the preview CDNs into a policy only when the ads option is on', () => {
    const base = { apiOrigin: 'https://api.example.com' }
    const withAds = buildContentSecurityPolicy({ ...base, ads: true })

    expect(withAds).toMatch(
      /img-src[^;]*https:\/\/\*\.googleusercontent\.com[^;]*https:\/\/\*\.fbcdn\.net/,
    )
    // The removed widenings must stay removed:
    expect(withAds).not.toContain('accounts.google.com')
    expect(withAds).not.toContain('www.facebook.com')
    // The token endpoints are server-to-server only — never browser-allowed.
    expect(withAds).not.toContain('oauth2.googleapis.com')
    expect(withAds).not.toContain('graph.facebook.com')

    const withoutAds = buildContentSecurityPolicy(base)
    expect(withoutAds).not.toContain('googleusercontent.com')
    expect(withoutAds).not.toContain('fbcdn.net')
  })

  it('admin includes the ads() preset origins and never widens script-src', () => {
    const csp = buildContentSecurityPolicyForApp('admin', { apiOrigin: 'https://api.example.com' })
    expect(csp).toContain('https://*.googleusercontent.com')
    expect(csp).toContain('https://*.fbcdn.net')
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
  // is same-origin by design, so this string is pinned and any ads() leak into
  // `storefront` fails this byte comparison.
  const SNAPSHOT_OPTIONS = {
    apiOrigin: 'https://api.example.com',
    mediaOrigin: 'https://media.example.com',
    themeAssetOrigin: 'https://cdn.example.com',
    kratosOrigin: 'https://auth.example.com',
  }

  it('storefront policy snapshot (byte-pinned; tightened in TASK-024)', () => {
    expect(buildContentSecurityPolicyForApp('storefront', SNAPSHOT_OPTIONS)).toBe(
      "default-src 'self'; script-src 'self' https://js.stripe.com https://*.stripe.com; style-src 'self' https://cdn.example.com; style-src-attr 'unsafe-inline'; img-src 'self' data: blob: https: https://media.example.com https://cdn.example.com https://*.stripe.com https://i.ytimg.com https://img.youtube.com; media-src 'self' blob: https: https://media.example.com; font-src 'self' data: https://cdn.example.com; frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://*.link.com https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be; connect-src 'self' https://api.example.com https://media.example.com https://auth.example.com https://api.stripe.com https://*.stripe.com https://*.link.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self' https://*.stripe.com; frame-ancestors 'none'",
    )
  })

  it('admin policy snapshot (byte-pinned; tightened in TASK-024)', () => {
    expect(buildContentSecurityPolicyForApp('admin', SNAPSHOT_OPTIONS)).toBe(
      "default-src 'self'; script-src 'self' https://js.stripe.com https://*.stripe.com; style-src 'self' https://cdn.example.com; style-src-attr 'unsafe-inline'; img-src 'self' data: blob: https: https://media.example.com https://cdn.example.com https://*.stripe.com https://i.ytimg.com https://img.youtube.com https://*.googleusercontent.com https://*.fbcdn.net; media-src 'self' blob: https: https://media.example.com; font-src 'self' data: https://cdn.example.com; frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://*.link.com https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be; connect-src 'self' https://api.example.com https://media.example.com https://auth.example.com https://api.stripe.com https://*.stripe.com https://*.link.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self' https://*.stripe.com",
    )
  })

  it('directives form agrees with the string form on the ad origins', () => {
    const storefront = buildContentSecurityPolicyDirectivesForApp('storefront', SNAPSHOT_OPTIONS)
    expect(storefront['img-src']).not.toContain('https://*.googleusercontent.com')
    expect(storefront['form-action']).not.toContain('https://www.facebook.com')

    const admin = buildContentSecurityPolicyDirectivesForApp('admin', SNAPSHOT_OPTIONS)
    expect(admin['img-src']).toEqual(
      expect.arrayContaining(['https://*.googleusercontent.com', 'https://*.fbcdn.net']),
    )
    expect(admin['connect-src']).not.toContain('https://accounts.google.com')
    expect(admin['form-action']).not.toContain('https://accounts.google.com')
    expect(admin['script-src']).not.toContain('unsafe-inline')
  })
})
