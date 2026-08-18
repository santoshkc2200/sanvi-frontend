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
    after?: number
    limit?: number
  },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/platform/audit', {
    params: { query },
    ...(signal ? { signal } : {}),
  })
}
