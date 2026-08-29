import { describe, expect, it, vi } from 'vitest'
import { load } from '../src/routes/+layout.server'

// The layout's privacy context fetch talks to the backend; the unit test
// stubs the module so only the layout's own logic (404 on unknown host,
// passthrough of locals + privacy, SEO alternate computation) is exercised.
vi.mock('$lib/privacy.server', () => ({
  loadPrivacyContext: vi.fn(async () => null),
}))

const requestWithCookies = { headers: { get: () => 'sanvi_consent=x' } } as never

const TENANT = {
  tenant_id: 't1',
  slug: 'acme',
  display_name: 'Acme',
  status: 'active',
  region: 'us',
  default_locale: 'en',
  resolution_source: 'subdomain',
}

describe('storefront root +layout.server.ts', () => {
  it('throws a 404 with no host/tenant enumeration signal when the host is unknown', async () => {
    const locals = { tenant: null, tenantResolution: 'unknown-host' as const, locale: 'en' }

    try {
      await load({
        locals,
        request: requestWithCookies,
        url: new URL('http://acme.test/'),
      } as never)
      expect.unreachable('load() should have thrown')
    } catch (thrown) {
      const httpError = thrown as { status: number; body: { message: string } }
      expect(httpError.status).toBe(404)
      expect(httpError.body.message.toLowerCase()).not.toContain('host')
      expect(httpError.body.message.toLowerCase()).not.toContain('tenant')
    }
  })

  it('returns tenant, locale, privacy and phase-06 SEO data when resolution succeeded', async () => {
    const locals = { tenant: TENANT, tenantResolution: 'ok' as const, locale: 'en' }

    const result = await load({
      locals,
      request: requestWithCookies,
      url: new URL('http://acme.test/privacy'),
    } as never)

    expect(result?.tenant).toEqual(TENANT)
    expect(result?.locale).toBe('en')
    expect(result?.privacy).toBeNull()
    expect(result?.seo.ogLocale).toBe('en_US')
    // The unprefixed page is the default locale's canonical form; ja gets a
    // prefixed alternate, plus x-default pointing at the unprefixed URL.
    expect(result?.seo.canonicalPath).toBe('/privacy')
    expect(result?.seo.alternates).toEqual([
      { locale: 'en', href: '/privacy' },
      { locale: 'ja', href: '/ja/privacy' },
      { locale: 'x-default', href: '/privacy' },
    ])
  })

  it('canonicalizes a prefixed path for a ja-default tenant', async () => {
    const locals = {
      tenant: { ...TENANT, default_locale: 'ja' },
      tenantResolution: 'ok' as const,
      locale: 'ja',
    }

    const result = await load({
      locals,
      request: requestWithCookies,
      url: new URL('http://acme.test/ja/privacy'),
    } as never)

    // A ja-default tenant serves ja unprefixed: the default locale IS the
    // canonical unprefixed form (the hook would 308 `/ja/privacy` here).
    expect(result?.seo.canonicalPath).toBe('/privacy')
    expect(result?.seo.alternates.find((a) => a.locale === 'ja')?.href).toBe('/privacy')
    expect(result?.seo.alternates.find((a) => a.locale === 'en')?.href).toBe('/en/privacy')
    expect(result?.seo.alternates.find((a) => a.locale === 'x-default')?.href).toBe('/privacy')
  })
})
