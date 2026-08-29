import { beforeEach, describe, expect, it, vi } from 'vitest'

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
