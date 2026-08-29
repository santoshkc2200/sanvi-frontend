import type { components } from './generated/types'
import type { TypedApiClient } from './typed'

type Schemas = components['schemas']

/**
 * Localization (phase 06). Two audiences, mirroring `privacy.ts`:
 *
 * - Public: `/api/v1/public/locales` — the platform's enabled locale set,
 *   consumed by SSR locale negotiation and the switchers. (The sibling
 *   `/api/v1/public/messages/{domain}` catalog-delivery endpoint is not
 *   wrapped here: the frontend owns its UI message set — compiled into
 *   `@sanvi/i18n` — and never fetches catalogs at runtime.)
 * - Operator consoles: `/api/v1/tenant/localization/*` (tenant admins:
 *   default/enabled locales, timezone, copy overrides) and
 *   `/api/v1/platform/localization/translations` (platform operators:
 *   catalog overrides merged over the backend's static catalogs).
 */

/** `GET /api/v1/public/locales` — the enabled locale set with native names, for negotiation and switchers. */
export function getSupportedLocales(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/public/locales', signal ? { signal } : undefined)
}

/** `GET /api/v1/tenant/localization/settings` — default locale, enabled locales, timezone. */
export function getLocalizationSettings(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/localization/settings', signal ? { signal } : undefined)
}

/** `PUT /api/v1/tenant/localization/settings` — replace default/enabled locales and timezone. */
export function updateLocalizationSettings(
  client: TypedApiClient,
  body: Schemas['UpdateLocalizationSettingsCommand'],
) {
  return client.PUT('/api/v1/tenant/localization/settings', body)
}

/** `GET /api/v1/tenant/localization/overrides` — this tenant's copy overrides. */
export function getLocalizationOverrides(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/localization/overrides', signal ? { signal } : undefined)
}

/** `PUT /api/v1/tenant/localization/overrides` — upsert a batch of overrides; returns the merged set. */
export function updateLocalizationOverrides(
  client: TypedApiClient,
  patches: Schemas['TranslationPatch'][],
) {
  return client.PUT('/api/v1/tenant/localization/overrides', patches)
}

/** `GET /api/v1/platform/localization/translations` — platform-wide catalog overrides. */
export function getPlatformTranslations(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/localization/translations', signal ? { signal } : undefined)
}

/** `PUT /api/v1/platform/localization/translations` — upsert a batch of platform overrides. */
export function updatePlatformTranslations(
  client: TypedApiClient,
  patches: Schemas['TranslationPatch'][],
) {
  return client.PUT('/api/v1/platform/localization/translations', patches)
}

/** One override row in the consoles' editors (view shape). */
export type TranslationView = Schemas['TranslationView']
