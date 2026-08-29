import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../src/client'
import {
  getPublicTheme,
  getTenantThemeDraft,
  listAvailableThemes,
  previewTenantTheme,
  publishTenantTheme,
  putTenantThemeDraft,
  rollbackTenantTheme,
  uploadBrandAsset,
} from '../src/theme'
import { createTypedApiClient } from '../src/typed'

function fakeClient(mockResponse: unknown = { ok: true }): {
  client: ApiClient
  request: ReturnType<typeof vi.fn>
} {
  const request = vi.fn().mockResolvedValue(mockResponse)
  return {
    request,
    client: {
      request,
      requestRaw: vi.fn().mockResolvedValue({ status: 200, body: mockResponse }),
      get: (path, options) => request(path, { ...options, method: 'GET' }),
      post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
      put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
      patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
      delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
    },
  }
}

describe('theme operations in api-client', () => {
  it('getPublicTheme calls GET /api/v1/public/theme', async () => {
    const mockTheme = {
      theme_key: 'dawn',
      theme_version: '1.0.0',
      theme_api: '^1.0.0',
      capabilities: [],
      tokens: {},
      css_vars: '',
      layouts: {},
      fonts: [],
      theme_assets: { screenshots: [] },
      brand_assets: {},
      revision: 1,
      locale: 'en',
      etag: '"etag-1"',
    }
    const { client, request } = fakeClient(mockTheme)
    const typed = createTypedApiClient(client)

    const result = await getPublicTheme(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/public/theme',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual(mockTheme)
  })

  it('listAvailableThemes calls GET /api/v1/tenant/themes/available', async () => {
    const mockThemes = {
      current_theme_key: 'dawn',
      current_theme_version: '1.0.0',
      themes: [],
    }
    const { client, request } = fakeClient(mockThemes)
    const typed = createTypedApiClient(client)

    const result = await listAvailableThemes(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/themes/available',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual(mockThemes)
  })

  it('getTenantThemeDraft calls GET /api/v1/tenant/theme/draft', async () => {
    const mockDraft = {
      theme: {
        theme_key: 'dawn',
        theme_version: '1.0.0',
        token_overrides: {},
        layout_overrides: {},
      },
      updated_at: '2026-08-29T10:00:00Z',
      has_unshared_changes: true,
    }
    const { client, request } = fakeClient(mockDraft)
    const typed = createTypedApiClient(client)

    const result = await getTenantThemeDraft(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/theme/draft',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual(mockDraft)
  })

  it('putTenantThemeDraft calls PUT /api/v1/tenant/theme/draft with command body', async () => {
    const payload = {
      theme_key: 'custom-dawn',
      token_overrides: { 'color.brand.primary': { $value: '#ff5500' } },
    }
    const mockResponse = {
      theme_key: 'custom-dawn',
      theme_version: '1.0.0',
      revision: 2,
      updated_at: '2026-08-29T10:05:00Z',
    }
    const { client, request } = fakeClient(mockResponse)
    const typed = createTypedApiClient(client)

    const result = await putTenantThemeDraft(typed, payload)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/theme/draft',
      expect.objectContaining({ method: 'PUT', body: payload }),
    )
    expect(result).toEqual(mockResponse)
  })

  it('putTenantThemeDraft propagates 400 problem details on invalid draft', async () => {
    const { client, request } = fakeClient()
    const error = new Error('Draft validation failed')
    request.mockRejectedValue(error)
    const typed = createTypedApiClient(client)

    await expect(putTenantThemeDraft(typed, { theme_key: 'invalid' })).rejects.toThrow(
      'Draft validation failed',
    )
  })

  it('uploadBrandAsset calls POST /api/v1/tenant/theme/assets with asset command', async () => {
    const payload = {
      kind: 'logo',
      content_type: 'image/png',
      data_base64:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    }
    const mockResponse = {
      theme_key: 'dawn',
      theme_version: '1.0.0',
      revision: 3,
      updated_at: '2026-08-29T10:10:00Z',
    }
    const { client, request } = fakeClient(mockResponse)
    const typed = createTypedApiClient(client)

    const result = await uploadBrandAsset(typed, payload)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/theme/assets',
      expect.objectContaining({ method: 'POST', body: payload }),
    )
    expect(result).toEqual(mockResponse)
  })

  it('previewTenantTheme calls GET /api/v1/tenant/theme/preview with token and locale query params', async () => {
    const mockPreviewTheme = {
      theme_key: 'dawn',
      theme_version: '1.0.0',
      theme_api: '^1.0.0',
      capabilities: [],
      tokens: {},
      css_vars: '',
      layouts: {},
      fonts: [],
      theme_assets: { screenshots: [] },
      brand_assets: {},
      revision: 4,
      locale: 'ja',
      etag: '"etag-preview"',
    }
    const { client, request } = fakeClient(mockPreviewTheme)
    const typed = createTypedApiClient(client)

    const result = await previewTenantTheme(typed, 'signed-token-123', 'ja')

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/theme/preview',
      expect.objectContaining({
        method: 'GET',
        query: { token: 'signed-token-123', locale: 'ja' },
      }),
    )
    expect(result).toEqual(mockPreviewTheme)
  })

  it('publishTenantTheme calls POST /api/v1/tenant/theme/publish without body', async () => {
    const mockPublished = {
      theme_key: 'dawn',
      theme_version: '1.0.0',
      revision: 5,
      updated_at: '2026-08-29T10:15:00Z',
    }
    const { client, request } = fakeClient(mockPublished)
    const typed = createTypedApiClient(client)

    const result = await publishTenantTheme(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/theme/publish',
      expect.objectContaining({ method: 'POST', body: undefined }),
    )
    expect(result).toEqual(mockPublished)
  })

  it('publishTenantTheme propagates 400 contrast validation and 409 conflict errors', async () => {
    const { client, request } = fakeClient()
    const error400 = new Error('Contrast requirement not met')
    request.mockRejectedValueOnce(error400)
    const typed = createTypedApiClient(client)

    await expect(publishTenantTheme(typed)).rejects.toThrow('Contrast requirement not met')

    const error409 = new Error('No draft to publish')
    request.mockRejectedValueOnce(error409)

    await expect(publishTenantTheme(typed)).rejects.toThrow('No draft to publish')
  })

  it('rollbackTenantTheme calls POST /api/v1/tenant/theme/rollback without body', async () => {
    const mockRolledBack = {
      theme_key: 'dawn',
      theme_version: '1.0.0',
      revision: 4,
      updated_at: '2026-08-29T10:20:00Z',
    }
    const { client, request } = fakeClient(mockRolledBack)
    const typed = createTypedApiClient(client)

    const result = await rollbackTenantTheme(typed)

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tenant/theme/rollback',
      expect.objectContaining({ method: 'POST', body: undefined }),
    )
    expect(result).toEqual(mockRolledBack)
  })

  it('rollbackTenantTheme propagates 409 no previous revision error', async () => {
    const { client, request } = fakeClient()
    const error409 = new Error('No previous revision to rollback to')
    request.mockRejectedValueOnce(error409)
    const typed = createTypedApiClient(client)

    await expect(rollbackTenantTheme(typed)).rejects.toThrow('No previous revision to rollback to')
  })
})
