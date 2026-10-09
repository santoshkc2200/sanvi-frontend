import { createApiClient, createTypedApiClient, type ApiClient } from '@sanvi/api-client'
import { createKratosClient, setSession } from '@sanvi/auth'
import { currentLocale } from '@sanvi/i18n'
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
 *
 * Phase 06: `locale` reads the live runtime locale per request (phase 00's
 * reserved slot), so every call carries `Accept-Language` — backend-emitted
 * strings (problem details, localized fields) arrive in the UI's language,
 * and a mid-session locale switch takes effect on the next call.
 */
function createRawClient(): ApiClient {
  return createApiClient({
    baseUrl: getAppEnv().apiOrigin,
    // Overridable per environment (the outage e2e shortens it); unset in
    // production, where the client's 10 s default is the decision.
    timeoutMs: getAppEnv().apiTimeoutMs,
    getTenantId: getActiveTenantId,
    credentials: 'include',
    locale: () => currentLocale(),
    onUnauthorized: () => setSession(null),
  })
}

const rawClient: ApiClient = createRawClient()

export const apiClient = createTypedApiClient(rawClient)

/**
 * The unwrapped transport client (TASK-025): the system probes
 * (`getSystemReadiness`) need `requestRaw` — the 503 readiness body is
 * states, not problem+json, so the throwing typed path would discard it.
 * Same underlying instance the typed client wraps.
 */
export const rawApiClient: ApiClient = rawClient

export const kratosClient = createKratosClient(getAppEnv().kratosOrigin)
