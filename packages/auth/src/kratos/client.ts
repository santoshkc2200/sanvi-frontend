import { createApiClient } from '@sanvi/api-client'
import type { ApiClient } from '@sanvi/api-client'

/**
 * A second `createApiClient` instance pointed at Kratos's public origin
 * instead of our own API — still the one physical `fetch` call site
 * (`@sanvi/api-client/src/client.ts`), just configured differently. Kratos
 * isn't in our OpenAPI spec, so this uses the plain (untyped) `ApiClient`,
 * not `TypedApiClient` — `kratos/flow.ts` applies `KratosFlow` at the call
 * site instead.
 */
export function createKratosClient(kratosOrigin: string): ApiClient {
  return createApiClient({
    baseUrl: kratosOrigin,
    credentials: 'include',
  })
}
