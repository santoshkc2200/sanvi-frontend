import type { components } from './generated/types'
import type { TypedApiClient } from './typed'

type Schemas = components['schemas']

export type ResolvedTheme = Schemas['ResolvedTheme']
export type AvailableThemesView = Schemas['AvailableThemesView']
export type TenantThemeDraftView = Schemas['TenantThemeDraftView']
export type TenantThemeView = Schemas['TenantThemeView']
export type UpdateTenantThemeDraftCommand = Schemas['UpdateTenantThemeDraftCommand']
export type UploadBrandAssetCommand = Schemas['UploadBrandAssetCommand']

/**
 * Theming (phase 07).
 *
 * - Public: `GET /api/v1/public/theme` — host-resolved live theme for SSR storefront.
 * - Operator / tenant theme editor:
 *   - `GET /api/v1/tenant/themes/available` — available theme catalog and active theme.
 *   - `GET /api/v1/tenant/theme/draft` — draft theme state.
 *   - `PUT /api/v1/tenant/theme/draft` — update draft theme tokens/layouts.
 *   - `POST /api/v1/tenant/theme/assets` — upload brand asset (logo, favicon, og_image).
 *   - `GET /api/v1/tenant/theme/preview` — preview draft theme with signed token.
 *   - `POST /api/v1/tenant/theme/publish` — publish draft theme to live.
 *   - `POST /api/v1/tenant/theme/rollback` — rollback theme to previous revision.
 */

/** `GET /api/v1/public/theme` — the resolved live theme for the request host, ETag-cached. */
export function getPublicTheme(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/public/theme', signal ? { signal } : undefined)
}

/** `GET /api/v1/tenant/themes/available` — list available installed themes for the tenant. */
export function listAvailableThemes(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/themes/available', signal ? { signal } : undefined)
}

/** `GET /api/v1/tenant/theme/draft` — the current draft theme state. */
export function getTenantThemeDraft(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/theme/draft', signal ? { signal } : undefined)
}

/** `PUT /api/v1/tenant/theme/draft` — update draft theme overrides/custom CSS/key. */
export function putTenantThemeDraft(
  client: TypedApiClient,
  body: Schemas['UpdateTenantThemeDraftCommand'],
  signal?: AbortSignal,
) {
  return client.PUT('/api/v1/tenant/theme/draft', body, signal ? { signal } : undefined)
}

/** `POST /api/v1/tenant/theme/assets` — upload a tenant brand asset (logo, favicon, OG image). */
export function uploadBrandAsset(
  client: TypedApiClient,
  body: Schemas['UploadBrandAssetCommand'],
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/tenant/theme/assets', body, signal ? { signal } : undefined)
}

/** `GET /api/v1/tenant/theme/preview` — preview draft theme rendered through signed token. */
export function previewTenantTheme(
  client: TypedApiClient,
  token: string,
  locale?: string,
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/tenant/theme/preview', {
    params: { query: { token, ...(locale ? { locale } : {}) } },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/tenant/theme/publish` — publish draft theme to live. */
export function publishTenantTheme(client: TypedApiClient, signal?: AbortSignal) {
  return client.POST('/api/v1/tenant/theme/publish', undefined, signal ? { signal } : undefined)
}

/** `POST /api/v1/tenant/theme/rollback` — rollback live theme to previous revision. */
export function rollbackTenantTheme(client: TypedApiClient, signal?: AbortSignal) {
  return client.POST('/api/v1/tenant/theme/rollback', undefined, signal ? { signal } : undefined)
}
