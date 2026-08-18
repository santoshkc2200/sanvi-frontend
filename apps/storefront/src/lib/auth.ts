import { createApiClient, createTypedApiClient } from '@sanvi/api-client'
import { createKratosClient } from '@sanvi/auth'
import { getAppEnv } from './env'

/**
 * Browser-side clients — Kratos self-service flows and anything reading the
 * session cookie only ever run client-side here (see `routes/login/+page.ts`'s
 * `ssr = false`: SSR can't meaningfully hold Kratos's flow cookie for a
 * single browser visit). Server-side session resolution is a separate,
 * per-request client built in `hooks.server.ts` via `@sanvi/auth/server`.
 */
export const apiClient = createTypedApiClient(
  createApiClient({ baseUrl: getAppEnv().apiOrigin, credentials: 'include' }),
)

export const kratosClient = createKratosClient(getAppEnv().kratosOrigin)
