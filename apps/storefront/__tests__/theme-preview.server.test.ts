import { beforeEach, describe, expect, it, vi } from 'vitest'
import { load } from '../src/routes/_theme-preview/+page.server'

const previewTenantThemeMock = vi.fn()
vi.mock('@sanvi/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sanvi/api-client')>()
  return {
    ...actual,
    previewTenantTheme: (...args: unknown[]) => previewTenantThemeMock(...args),
  }
})

const TENANT = {
  tenant_id: 't1',
  slug: 'acme',
  display_name: 'Acme',
  status: 'active',
  region: 'us',
  default_locale: 'en',
  resolution_source: 'subdomain',
}

describe('storefront _theme-preview/+page.server.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets X-Robots-Tag: noindex header and requires ?token= parameter (403 on missing)', async () => {
    const setHeaders = vi.fn()
    const locals = { tenant: TENANT, tenantResolution: 'ok' as const, locale: 'en' }

    try {
      await load({
        url: new URL('http://acme.test/_theme-preview'),
        locals,
        setHeaders,
      } as never)
      expect.unreachable('load() should have thrown 403')
    } catch (thrown) {
      const httpError = thrown as { status: number; body: { message: string } }
      expect(httpError.status).toBe(403)
      expect(setHeaders).toHaveBeenCalledWith(
        expect.objectContaining({
          'x-robots-tag': 'noindex',
        }),
      )
    }
  })

  it('throws 403 on invalid or expired preview token', async () => {
    const setHeaders = vi.fn()
    const locals = { tenant: TENANT, tenantResolution: 'ok' as const, locale: 'en' }
    previewTenantThemeMock.mockRejectedValueOnce(new Error('Invalid token'))

    try {
      await load({
        url: new URL('http://acme.test/_theme-preview?token=bad-token'),
        locals,
        setHeaders,
      } as never)
      expect.unreachable('load() should have thrown 403')
    } catch (thrown) {
      const httpError = thrown as { status: number }
      expect(httpError.status).toBe(403)
      expect(setHeaders).toHaveBeenCalledWith(
        expect.objectContaining({
          'x-robots-tag': 'noindex',
        }),
      )
    }
  })

  it('calls previewTenantTheme with token and locale, returning the resolved theme', async () => {
    const setHeaders = vi.fn()
    const locals = { tenant: TENANT, tenantResolution: 'ok' as const, locale: 'en' }
    const mockPreviewTheme = {
      theme_key: 'custom-preview',
      theme_version: '1.0.0',
      theme_api: '^1.0.0',
      capabilities: [],
      tokens: { 'color.brand.primary': { $value: '#123456' } },
      css_vars: ':root { --sanvi-color-brand-primary: #123456; }',
      layouts: {
        'storefront.home': { slots: ['header', 'hero', 'footer'] },
      },
      fonts: [],
      theme_assets: { screenshots: [] },
      brand_assets: {},
      revision: 2,
      locale: 'ja',
      etag: '"etag-preview-1"',
    }
    previewTenantThemeMock.mockResolvedValueOnce(mockPreviewTheme)

    const result = await load({
      url: new URL('http://acme.test/_theme-preview?token=valid-token-123&locale=ja'),
      locals,
      setHeaders,
    } as never)

    expect(setHeaders).toHaveBeenCalledWith(
      expect.objectContaining({
        'x-robots-tag': 'noindex',
      }),
    )
    expect(previewTenantThemeMock).toHaveBeenCalledWith(expect.anything(), 'valid-token-123', 'ja')
    expect(result).toEqual({
      theme: mockPreviewTheme,
      previewToken: 'valid-token-123',
    })
  })
})
