import type { TypedApiClient } from './typed'

/** `GET /api/v1/platform/impersonations` — active grants, optionally scoped to one tenant. */
export function listImpersonations(
  client: TypedApiClient,
  query?: { tenant_id?: string; limit?: number },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/platform/impersonations', {
    params: { query },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/platform/impersonations` — start a time-boxed grant. Requires fresh MFA (aal2 step-up); read-only mode rejects unsafe methods on the target session. */
export function createImpersonation(
  client: TypedApiClient,
  body: {
    tenant_id: string
    target_user_id: string
    reason: string
    duration_minutes: number
    mode?: 'read_only' | 'read_write'
  },
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/platform/impersonations', body, signal ? { signal } : undefined)
}

/** `DELETE /api/v1/platform/impersonations/{id}` — force-end a grant. */
export function revokeImpersonation(client: TypedApiClient, grantId: string, signal?: AbortSignal) {
  return client.DELETE('/api/v1/platform/impersonations/{id}', {
    params: { path: { id: grantId } },
    ...(signal ? { signal } : {}),
  })
}
