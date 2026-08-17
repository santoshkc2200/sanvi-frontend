import { beforeEach, describe, expect, it, vi } from 'vitest'

// `PUBLIC_API_ORIGIN` below matches vitest.config.ts's `$env/dynamic/public` alias stub.
const resolveTenantForHostMock = vi.fn()
vi.mock('@sanvi/tenant/server', () => ({
  TenantHostCache: vi.fn(),
  resolveTenantForHost: (...args: unknown[]) => resolveTenantForHostMock(...args),
}))

vi.mock('@sanvi/csp', () => ({
  buildContentSecurityPolicyForApp: () => "default-src 'self'",
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
})
