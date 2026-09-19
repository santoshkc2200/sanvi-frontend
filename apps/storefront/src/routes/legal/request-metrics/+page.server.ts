import {
  ApiError,
  createApiClient,
  createTypedApiClient,
  getPublicMetrics,
} from '@sanvi/api-client'
import { getAppEnv } from '$lib/env'
import type { PageServerLoad } from './$types'

/** The CCPA-style annual request metrics disclosure, generated from the request ledger. */
export const prerender = false

export const load: PageServerLoad = async (event) => {
  const { apiOrigin } = getAppEnv()
  // The caller's cookies ride along (the same BFF passthrough
  // `resolveSession` uses) — the backend reads jurisdiction context from the
  // subject's cookies, and the mock fixture keys its traced-failure branch
  // the same way. (Node's fetch would drop a custom `host` header, so a
  // host-based discriminator is not available server-side.)
  const cookie = event.request.headers.get('cookie')
  const client = createTypedApiClient(
    createApiClient({
      baseUrl: apiOrigin,
      getExtraHeaders: () => (cookie ? { cookie } : undefined),
    }),
  )
  const year = new Date().getUTCFullYear() - 1
  try {
    return { metrics: await getPublicMetrics(client, { year }), year }
  } catch (error) {
    // The page degrades to its labelled-unavailable state (that design
    // predates TASK-020 and stands), but the failure is not swallowed
    // silently: the trace id rides along, and the page attaches it — plus
    // the copy-diagnostics action — to the same surface. A degraded page
    // that hides its correlation id turns a one-paste support contact into
    // an interrogation.
    return { metrics: null, year, traceId: error instanceof ApiError ? error.traceId : null }
  }
}
