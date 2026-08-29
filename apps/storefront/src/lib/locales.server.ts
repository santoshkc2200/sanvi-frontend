import { createApiClient, createTypedApiClient, getSupportedLocales } from '@sanvi/api-client'
import { isLocale, LOCALES, type Locale } from '@sanvi/i18n'
import { getAppEnv } from './env'

/**
 * The locale set this storefront may serve, from `GET /api/v1/public/locales`
 * (the platform operator's enabled list), cached process-wide for a minute.
 *
 * Shared across requests on purpose — same reasoning as
 * `@sanvi/tenant/server`'s `TenantHostCache`: it caches *platform* data,
 * keyed by nothing per-request, so concurrent SSR requests share it safely.
 * A tenant's own enabled-locale restriction isn't publicly exposed yet
 * (`TenantContext` carries only `default_locale`); when the backend adds it
 * to the public tenant context, this is where the intersection happens.
 */
const FRESH_MS = 60_000

let cached: { locales: Locale[]; fetchedAt: number; revalidating: boolean } = {
  locales: [...LOCALES],
  fetchedAt: 0,
  revalidating: false,
}

/**
 * Synchronously readable (the hook and layout `load` never await it): serves
 * the last known set and refreshes in the background when stale. The initial
 * fallback is the compile-time `LOCALES` — a locales-endpoint outage must
 * not change which prefixes are recognized mid-flight, and `en`/`ja` is the
 * shipped set anyway.
 */
export function getAvailableLocales(): Locale[] {
  const age = Date.now() - cached.fetchedAt
  if (age > FRESH_MS && !cached.revalidating) {
    cached.revalidating = true
    void refresh()
  }
  return cached.locales
}

async function refresh(): Promise<void> {
  try {
    // A fresh client per refresh, built from the runtime env — this module
    // is only ever used server-side (`.server.ts`), where a shared client
    // would be fine too, but the client carries no state worth sharing.
    const client = createTypedApiClient(createApiClient({ baseUrl: getAppEnv().apiOrigin }))
    const view = await getSupportedLocales(client)
    const locales = (view?.locales ?? []).map((entry) => entry.code).filter(isLocale)
    if (locales.length > 0) {
      cached = { locales, fetchedAt: Date.now(), revalidating: false }
      return
    }
    throw new Error('locales endpoint returned an empty set')
  } catch {
    // Keep serving the last known-good (or default) set; retry after FRESH_MS.
    cached = { ...cached, fetchedAt: Date.now(), revalidating: false }
  }
}
