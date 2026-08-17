import { describe, expect, it } from 'vitest'
import { load } from '../src/routes/+layout.server'

describe('storefront root +layout.server.ts', () => {
  it('throws a 404 with no host/tenant enumeration signal when the host is unknown', () => {
    const locals = { tenant: null, tenantResolution: 'unknown-host' as const, locale: 'en' }

    try {
      load({ locals } as never)
      expect.unreachable('load() should have thrown')
    } catch (thrown) {
      const httpError = thrown as { status: number; body: { message: string } }
      expect(httpError.status).toBe(404)
      expect(httpError.body.message.toLowerCase()).not.toContain('host')
      expect(httpError.body.message.toLowerCase()).not.toContain('tenant')
    }
  })

  it('returns the tenant and locale when resolution succeeded', () => {
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

    expect(load({ locals } as never)).toEqual({ tenant, locale: 'en' })
  })
})
