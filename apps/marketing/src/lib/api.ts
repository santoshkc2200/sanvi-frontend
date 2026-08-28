import { createApiClient, createTypedApiClient } from '@sanvi/api-client'
import { getAppEnv } from './env'

let cachedClient: ReturnType<typeof createTypedApiClient> | undefined

export function getMarketingApiClient() {
  if (cachedClient) return cachedClient
  cachedClient = createTypedApiClient(
    createApiClient({
      baseUrl: getAppEnv().apiOrigin,
    }),
  )
  return cachedClient
}
