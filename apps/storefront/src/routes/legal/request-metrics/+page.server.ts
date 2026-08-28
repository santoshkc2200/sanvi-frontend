import { createApiClient, createTypedApiClient, getPublicMetrics } from '@sanvi/api-client'
import { getAppEnv } from '$lib/env'
import type { PageServerLoad } from './$types'

/** The CCPA-style annual request metrics disclosure, generated from the request ledger. */
export const prerender = false

export const load: PageServerLoad = async () => {
  const { apiOrigin } = getAppEnv()
  const client = createTypedApiClient(createApiClient({ baseUrl: apiOrigin }))
  const year = new Date().getUTCFullYear() - 1
  try {
    return { metrics: await getPublicMetrics(client, { year }), year }
  } catch {
    return { metrics: null, year }
  }
}
