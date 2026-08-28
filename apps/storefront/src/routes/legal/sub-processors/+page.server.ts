import { createApiClient, createTypedApiClient, listPublicSubprocessors } from '@sanvi/api-client'
import { getAppEnv } from '$lib/env'
import type { PageServerLoad } from './$types'

/** The public sub-processor list needs no auth and no cookies. */
export const prerender = false

export const load: PageServerLoad = async () => {
  const { apiOrigin } = getAppEnv()
  const client = createTypedApiClient(createApiClient({ baseUrl: apiOrigin }))
  try {
    return { subprocessors: await listPublicSubprocessors(client) }
  } catch {
    return { subprocessors: null }
  }
}
