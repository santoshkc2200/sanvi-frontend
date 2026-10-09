import { createApiClient, createTypedApiClient, listPublicSubprocessors } from '@sanvi/api-client'
import { buildDiagnosticsPaste, errorTraceId } from '@sanvi/telemetry/diagnostics'
import { currentLocale } from '@sanvi/i18n'
import { getAppEnv } from '$lib/env'
import type { PageServerLoad } from './$types'

/** The public sub-processor list needs no auth and no cookies. */
export const prerender = false

export const load: PageServerLoad = async () => {
  const { apiOrigin } = getAppEnv()
  const client = createTypedApiClient(createApiClient({ baseUrl: apiOrigin }))
  try {
    return { subprocessors: await listPublicSubprocessors(client) }
  } catch (err) {
    // TASK-023 (FR-1106 parity with request-metrics): the degraded state
    // carries its correlation — the failed request's trace id, or the one
    // this client last sent. Breadcrumbs stay empty on the server: the
    // shared buffer is per-process, and cross-request recall would leak one
    // visitor's navigation into another's paste.
    const traceId = errorTraceId(err) ?? client.getLastTraceId()
    return {
      subprocessors: null,
      traceId,
      diagnosticsText: traceId
        ? buildDiagnosticsPaste({
            release: __APP_BUILD__,
            route: '/legal/sub-processors',
            tenantId: null,
            locale: currentLocale(),
            traceId,
            breadcrumbs: [],
          })
        : undefined,
    }
  }
}
