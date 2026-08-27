import { createApiClient, createTypedApiClient } from '@sanvi/api-client'
import { createKratosClient, setSession } from '@sanvi/auth'
import { getActiveTenantId } from '@sanvi/tenant'
import { getAppEnv } from './env'

/**
 * One instance for the app's lifetime — the SPA has exactly one browser tab
 * per session, unlike the storefront's SSR process, which must build a
 * fresh client per request. `getTenantId` is read per-request (not cached
 * here), so a tenant switch takes effect on the very next call.
 * `credentials: 'include'` — phase 02 onward, every call needs the Kratos
 * session cookie sent. `onUnauthorized` clears the session store the moment
 * the backend rejects the cookie, so a session revoked underneath the tab
 * stops satisfying the route guards on the next navigation instead of
 * lingering until reload.
 */
export const apiClient = createTypedApiClient(
  createApiClient({
    baseUrl: getAppEnv().apiOrigin,
    getTenantId: getActiveTenantId,
    credentials: 'include',
    onUnauthorized: () => setSession(null),
  }),
)

export const kratosClient = createKratosClient(getAppEnv().kratosOrigin)
