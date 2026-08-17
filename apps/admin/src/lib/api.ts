import { createApiClient, createTypedApiClient } from '@sanvi/api-client'
import { getActiveTenantId } from '@sanvi/tenant'
import { getAppEnv } from './env'

/**
 * One instance for the app's lifetime — the SPA has exactly one browser tab
 * per session, unlike the storefront's SSR process, which must build a
 * fresh client per request. `getTenantId` is read per-request (not cached
 * here), so a tenant switch takes effect on the very next call.
 */
export const apiClient = createTypedApiClient(
  createApiClient({
    baseUrl: getAppEnv().apiOrigin,
    getTenantId: getActiveTenantId,
  }),
)
