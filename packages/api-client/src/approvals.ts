import type { TypedApiClient } from './typed'

/** `GET /api/v1/platform/approvals` — pending four-eyes requests. */
export function listPendingApprovals(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/approvals', signal ? { signal } : undefined)
}

/** `POST /api/v1/platform/approvals/{id}/approve` — approve and execute. The backend rejects self-approval and stale MFA independently of what the UI shows. */
export function approveRequest(client: TypedApiClient, approvalId: string, signal?: AbortSignal) {
  return client.POST('/api/v1/platform/approvals/{id}/approve', undefined, {
    params: { path: { id: approvalId } },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/platform/approvals/{id}/reject` — reject a pending request. */
export function rejectRequest(client: TypedApiClient, approvalId: string, signal?: AbortSignal) {
  return client.POST('/api/v1/platform/approvals/{id}/reject', undefined, {
    params: { path: { id: approvalId } },
    ...(signal ? { signal } : {}),
  })
}
