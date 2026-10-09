import type { TypedApiClient } from './typed'

/** `GET /api/v1/platform/audit` — the platform audit chain, newest first, cursor-paginated by `seq`. */
export function listAudit(
  client: TypedApiClient,
  query?: {
    tenant_id?: string
    actor_id?: string
    action?: string
    since?: string
    until?: string
    /** Opaque cursor (TASK-026: the spec changed this from a number to a string — pass back verbatim, never parse). */
    after?: string
    limit?: number
  },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/platform/audit', {
    params: { query },
    ...(signal ? { signal } : {}),
  })
}
