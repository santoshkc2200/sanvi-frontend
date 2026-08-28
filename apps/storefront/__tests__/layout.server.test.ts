import { describe, expect, it, vi } from 'vitest'
import { load } from '../src/routes/+layout.server'

// The layout's privacy context fetch talks to the backend; the unit test
// stubs the module so only the layout's own logic (404 on unknown host,
// passthrough of locals + privacy) is exercised.
vi.mock('$lib/privacy.server', () => ({
  loadPrivacyContext: vi.fn(async () => null),
}))

const requestWithCookies = { headers: { get: () => 'sanvi_consent=x' } } as never

describe('storefront root +layout.server.ts', () => {
  it('throws a 404 with no host/tenant enumeration signal when the host is unknown', async () => {
    const locals = { tenant: null, tenantResolution: 'unknown-host' as const, locale: 'en' }

    try {
      await load({ locals, request: requestWithCookies } as never)
      expect.unreachable('load() should have thrown')
    } catch (thrown) {
      const httpError = thrown as { status: number; body: { message: string } }
      expect(httpError.status).toBe(404)
      expect(httpError.body.message.toLowerCase()).not.toContain('host')
      expect(httpError.body.message.toLowerCase()).not.toContain('tenant')
    }
  })

  it('returns the tenant, locale and privacy context when resolution succeeded', async () => {
    const tenant = {
      tenant_id: 't1',
      slug: 'acme',
      display_name: 'Acme',
      status: 'active',
      region: 'us',
      default_locale: 'en',
      resolution_source: 'subdomain',
    }
    const locals = { tenant, tenantResolution: 'ok' as const, locale: 'en' }

    const result = await load({ locals, request: requestWithCookies } as never)
    expect(result).toEqual({ tenant, locale: 'en', privacy: null })
  })
})
