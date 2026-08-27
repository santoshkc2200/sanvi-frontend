import { createApiClient, createTypedApiClient } from '@sanvi/api-client'
import { createKratosClient, setSession } from '@sanvi/auth'
import { getAppEnv } from './env'

/**
 * No `getTenantId` — platform operators act across every tenant, never
 * scoped to one (that's `@sanvi/admin`'s job). One instance for the app's
 * lifetime, same reasoning as `@sanvi/admin`'s `lib/api.ts`.
 * `credentials: 'include'` — phase 02 onward, every call needs the Kratos
 * session cookie sent. `onUnauthorized` clears the session store the moment
 * the backend rejects the cookie, so a session revoked underneath the tab
 * stops satisfying the aal2 guards on the next navigation instead of
 * lingering until reload.
 */
export const apiClient = createTypedApiClient(
  createApiClient({
    baseUrl: getAppEnv().apiOrigin,
    credentials: 'include',
    onUnauthorized: () => setSession(null),
  }),
)

export const kratosClient = createKratosClient(getAppEnv().kratosOrigin)
