import { createApiClient, createTypedApiClient } from '@sanvi/api-client'
import { getAppEnv } from './env'

/**
 * No `getTenantId` — platform operators act across every tenant, never
 * scoped to one (that's `@sanvi/admin`'s job). One instance for the app's
 * lifetime, same reasoning as `@sanvi/admin`'s `lib/api.ts`.
 */
export const apiClient = createTypedApiClient(
  createApiClient({
    baseUrl: getAppEnv().apiOrigin,
  }),
)
