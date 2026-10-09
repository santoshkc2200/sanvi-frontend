import {
  createApiClient,
  createTypedApiClient,
  type ApiClient,
  type TypedApiClient,
} from '@sanvi/api-client'
import { getAppEnv } from './env'

let cachedRaw: ApiClient | undefined
let cachedTyped: TypedApiClient | undefined

function getRawClient(): ApiClient {
  if (!cachedRaw) {
    cachedRaw = createApiClient({ baseUrl: getAppEnv().apiOrigin })
  }
  return cachedRaw
}

export function getMarketingApiClient(): TypedApiClient {
  if (!cachedTyped) cachedTyped = createTypedApiClient(getRawClient())
  return cachedTyped
}

/**
 * The unwrapped transport client (TASK-025): the system probes
 * (`getSystemHealth`, `getSystemReadiness`) need `requestRaw` — the 503
 * readiness body is states, not problem+json, so the throwing typed path
 * would discard it. Same underlying instance the typed client wraps.
 */
export function getMarketingRawApiClient(): ApiClient {
  return getRawClient()
}
