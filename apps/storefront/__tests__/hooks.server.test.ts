import { currentLocale } from '@sanvi/i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveLocale } from '../src/hooks.server'

// `PUBLIC_API_ORIGIN` below matches vitest.config.ts's `$env/dynamic/public` alias stub.
const resolveTenantForHostMock = vi.fn()
vi.mock('@sanvi/tenant/server', () => ({
  TenantHostCache: vi.fn(),
  resolveTenantForHost: (...args: unknown[]) => resolveTenantForHostMock(...args),
}))

const buildDirectivesMock = vi.fn()
vi.mock('@sanvi/csp', () => ({
  buildContentSecurityPolicyForApp: () => "default-src 'self'",
  buildContentSecurityPolicyDirectivesForApp: (...args: unknown[]) => buildDirectivesMock(...args),
}))

describe('storefront hooks.server.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolveTenant sets locals.tenant + tenantResolution from the Host header, via @sanvi/tenant/server', async () => {
    const { resolveTenant } = await import('../src/hooks.server')
    const tenant = {
      tenant_id: 't1',
      slug: 'acme',
      display_name: 'Acme',
      status: 'active',
      region: 'us',
      default_locale: 'en',
      resolution_source: 'subdomain',
    }
    resolveTenantForHostMock.mockResolvedValueOnce({ status: 'ok', tenant })

    const locals: Record<string, unknown> = {}
    const event = {
      request: new Request('http://ignored.internal/', { headers: { host: 'acme.example' } }),
      url: new URL('http://ignored.internal/'),
      locals,
    }
    const resolve = vi.fn().mockResolvedValue(new Response('ok'))

    await resolveTenant({ event: event as never, resolve: resolve as never })

    expect(resolveTenantForHostMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ apiOrigin: 'https://api.example.test', host: 'acme.example' }),
    )
    expect(locals.tenant).toEqual(tenant)
    expect(locals.tenantResolution).toBe('ok')
    expect(resolve).toHaveBeenCalledWith(event)
  })

  it('resolveTenant sets tenant null + unknown-host when the host has no tenant', async () => {
    const { resolveTenant } = await import('../src/hooks.server')
    resolveTenantForHostMock.mockResolvedValueOnce({ status: 'unknown-host', tenant: null })

    const locals: Record<string, unknown> = {}
    const event = {
      request: new Request('http://ignored.internal/', { headers: { host: 'ghost.example' } }),
      url: new URL('http://ignored.internal/'),
      locals,
    }
    const resolve = vi.fn().mockResolvedValue(new Response('ok'))

    await resolveTenant({ event: event as never, resolve: resolve as never })

    expect(locals.tenant).toBeNull()
    expect(locals.tenantResolution).toBe('unknown-host')
  })

  /**
   * `kit.csp` freezes its origins at build time; the app reads them at
   * runtime. Without this rewrite a build promoted to another environment
   * ships a `connect-src` naming an origin it never calls, and every API
   * request dies in the browser with nothing to see server-side.
   */
  describe('runtimeConnectSrc', () => {
    function respondWith(csp: string | null) {
      const headers = csp ? { 'content-security-policy': csp } : undefined
      return vi.fn().mockResolvedValue(new Response('ok', { headers }))
    }

    const event = { url: new URL('http://ignored.internal/') }

    it('replaces connect-src with the runtime origins and leaves other directives alone', async () => {
      const { runtimeConnectSrc } = await import('../src/hooks.server')
      buildDirectivesMock.mockReturnValue({
        'connect-src': ["'self'", 'https://api.example.test', 'https://kratos.example.test'],
      })
      const resolve = respondWith(
        "default-src 'self'; script-src 'self' 'sha256-abc'; connect-src 'self' https://api.stale.test",
      )

      const response = await runtimeConnectSrc({ event: event as never, resolve: resolve as never })

      expect(response.headers.get('content-security-policy')).toBe(
        "default-src 'self'; script-src 'self' 'sha256-abc'; " +
          "connect-src 'self' https://api.example.test https://kratos.example.test",
      )
      expect(buildDirectivesMock).toHaveBeenCalledWith(
        'storefront',
        expect.objectContaining({
          apiOrigin: 'https://api.example.test',
          kratosOrigin: 'https://kratos.example.test',
        }),
      )
    })

    it('leaves a response without a CSP header untouched', async () => {
      const { runtimeConnectSrc } = await import('../src/hooks.server')
      buildDirectivesMock.mockReturnValue({ 'connect-src': ["'self'"] })
      const resolve = respondWith(null)

      const response = await runtimeConnectSrc({ event: event as never, resolve: resolve as never })

      expect(response.headers.get('content-security-policy')).toBeNull()
    })
  })
})

// ── Phase 06: resolveLocale ──

describe('resolveLocale', () => {
  const TENANT_EN = {
    tenant_id: 't1',
    slug: 'acme',
    display_name: 'Acme',
    status: 'active',
    region: 'us',
    default_locale: 'en',
    resolution_source: 'subdomain',
  }

  function event(overrides: {
    pathname?: string
    localeCookie?: string
    sessionLocale?: string | null
    tenant?: typeof TENANT_EN
    acceptLanguage?: string | null
    method?: string
    isDataRequest?: boolean
  }) {
    const url = new URL(`http://acme.test${overrides.pathname ?? '/'}`)
    return {
      request: new Request(url, {
        method: overrides.method ?? 'GET',
        headers: overrides.acceptLanguage ? { 'accept-language': overrides.acceptLanguage } : {},
      }),
      url,
      isDataRequest: overrides.isDataRequest ?? false,
      cookies: { get: (_name: string) => overrides.localeCookie },
      locals: {
        tenant: overrides.tenant ?? TENANT_EN,
        tenantResolution: 'ok',
        session: overrides.sessionLocale ? { locale: overrides.sessionLocale } : null,
      },
    } as never
  }

  /**
   * The kit `resolve` stub records the options (`transformPageChunk`) and
   * answers from the *ambient i18n locale* — proving the render ran inside
   * `runWithLocale`'s AsyncLocalStorage scope.
   */
  async function runLocaleTest(eventInput: ReturnType<typeof event>) {
    let seenLocale: string | undefined
    let seenChunk: ((chunk: { html: string }) => string) | undefined
    const resolve = vi.fn(async (_event: unknown, options?: { transformPageChunk?: never }) => {
      const transform = options?.['transformPageChunk'] as
        | ((chunk: { html: string }) => string)
        | undefined
      seenChunk = transform
      seenLocale = currentLocale()
      return new Response('<html lang="en"><body>ok</body></html>', {
        headers: { 'content-type': 'text/html' },
      })
    })
    const response = await resolveLocale({ event: eventInput, resolve: resolve as never })
    return { response, seenLocale, transform: seenChunk }
  }

  it('serves the unprefixed default locale without a redirect, inside runWithLocale', async () => {
    const { response, seenLocale, transform } = await runLocaleTest(event({ pathname: '/' }))
    expect(seenLocale).toBe('en')
    expect(response.headers.get('content-language')).toBe('en')
    expect(response.headers.get('vary')?.toLowerCase()).toContain('accept-language')
    expect(transform?.({ html: '<html lang="en"></html>' })).toBe('<html lang="en"></html>')
  })

  it('renders a non-default locale prefix in that language, no flash of English', async () => {
    const { response, seenLocale, transform } = await runLocaleTest(
      event({ pathname: '/ja/privacy' }),
    )
    expect(response.status).toBe(200)
    expect(seenLocale).toBe('ja')
    expect(response.headers.get('content-language')).toBe('ja')
    expect(transform?.({ html: '<html lang="en"></html>' })).toBe('<html lang="ja"></html>')
  })

  it('308s a default-locale prefix to the canonical unprefixed URL', async () => {
    const { response } = await runLocaleTest(event({ pathname: '/en/privacy?flow=1' }))
    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('/privacy?flow=1')
  })

  it('307s an unprefixed request whose cookie picked a non-default locale', async () => {
    const { response } = await runLocaleTest(event({ pathname: '/privacy', localeCookie: 'ja' }))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/ja/privacy')
    expect(response.headers.get('vary')?.toLowerCase()).toContain('cookie')
  })

  it('tenant default outranks Accept-Language (mirrors the backend) — no redirect', async () => {
    // A ja browser on an en-default tenant gets English at `/` until they
    // explicitly switch (cookie/session) — the documented negotiation order.
    const { response, seenLocale } = await runLocaleTest(
      event({ pathname: '/', acceptLanguage: 'ja-JP,ja;q=0.9,en;q=0.8' }),
    )
    expect(response.status).toBe(200)
    expect(seenLocale).toBe('en')
  })

  it('the session preference beats Accept-Language', async () => {
    const { response } = await runLocaleTest(
      event({ pathname: '/', acceptLanguage: 'en', sessionLocale: 'ja' }),
    )
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/ja')
  })

  it('a ja-default tenant is served unprefixed even to ja browsers', async () => {
    const jaTenant = { ...TENANT_EN, default_locale: 'ja' }
    const { response, seenLocale } = await runLocaleTest(
      event({ pathname: '/', tenant: jaTenant, acceptLanguage: 'ja' }),
    )
    expect(response.status).toBe(200)
    expect(seenLocale).toBe('ja')
  })

  it('never redirects data requests or asset-shaped paths', async () => {
    for (const pathname of ['/favicon.svg', '/mock-analytics.js']) {
      const { response } = await runLocaleTest(event({ pathname, localeCookie: 'ja' }))
      expect(response.status, pathname).toBe(200)
    }
    const { response } = await runLocaleTest(
      event({ pathname: '/privacy', localeCookie: 'ja', isDataRequest: true }),
    )
    expect(response.status).toBe(200)
  })

  it('ignores an unconfigured prefix and renders the default at that path', async () => {
    const { response, seenLocale } = await runLocaleTest(event({ pathname: '/de/privacy' }))
    expect(response.status).toBe(200)
    expect(seenLocale).toBe('en')
  })

  it('skips /health entirely', async () => {
    const resolve = vi.fn(async () => new Response('ok'))
    const healthEvent = event({ pathname: '/health' })
    const response = await resolveLocale({ event: healthEvent, resolve: resolve as never })
    expect((await response.text()) === 'ok' || response.status === 200).toBe(true)
    expect(response.headers.get('content-language')).toBeNull()
  })
})
