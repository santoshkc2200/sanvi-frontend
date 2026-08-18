import type { TypedApiClient } from './typed'

/** `GET /api/v1/platform/tenants` — cursor-paginated tenant list for the operator console. */
export function listTenants(
  client: TypedApiClient,
  query?: { limit?: number; after?: string; status?: string },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/platform/tenants', {
    params: { query },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/platform/tenants` — provision a new tenant. */
export function provisionTenant(
  client: TypedApiClient,
  body: { slug: string; display_name: string; region: string; default_locale?: string },
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/platform/tenants', body, signal ? { signal } : undefined)
}

/** `GET /api/v1/platform/tenants/{id}` — one tenant by id. */
export function getTenant(client: TypedApiClient, tenantId: string, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/tenants/{id}', {
    params: { path: { id: tenantId } },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/platform/tenants/{id}/activate` — provisioning → active. */
export function activateTenant(client: TypedApiClient, tenantId: string, signal?: AbortSignal) {
  return client.POST('/api/v1/platform/tenants/{id}/activate', undefined, {
    params: { path: { id: tenantId } },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/platform/tenants/{id}/suspend` — active → suspended; requires a reason. */
export function suspendTenant(
  client: TypedApiClient,
  tenantId: string,
  body: { reason: string },
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/platform/tenants/{id}/suspend', body, {
    params: { path: { id: tenantId } },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/platform/tenants/{id}/resume` — suspended → active. */
export function resumeTenant(client: TypedApiClient, tenantId: string, signal?: AbortSignal) {
  return client.POST('/api/v1/platform/tenants/{id}/resume', undefined, {
    params: { path: { id: tenantId } },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/platform/tenants/{id}/archive` — terminal lifecycle state. */
export function archiveTenant(client: TypedApiClient, tenantId: string, signal?: AbortSignal) {
  return client.POST('/api/v1/platform/tenants/{id}/archive', undefined, {
    params: { path: { id: tenantId } },
    ...(signal ? { signal } : {}),
  })
}

/** `GET /api/v1/platform/admin/tenants` — the operator search view (name/slug/status, cursor-paginated). */
export function searchTenantAdminViews(
  client: TypedApiClient,
  query?: {
    query?: string
    status?: string
    after_created_at?: string
    after_id?: string
    limit?: number
  },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/platform/admin/tenants', {
    params: { query },
    ...(signal ? { signal } : {}),
  })
}

/** `GET /api/v1/platform/admin/tenants/{id}` — one operator-view tenant row (member/override/impersonation counts). */
export function getTenantAdminView(client: TypedApiClient, tenantId: string, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/admin/tenants/{id}', {
    params: { path: { id: tenantId } },
    ...(signal ? { signal } : {}),
  })
}

/** `GET /api/v1/platform/tenants/{id}/entitlements` — a tenant's stored entitlement overrides. */
export function listEntitlementOverrides(
  client: TypedApiClient,
  tenantId: string,
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/platform/tenants/{id}/entitlements', {
    params: { path: { id: tenantId } },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `POST /api/v1/platform/tenants/{id}/entitlements` — grant (or request approval for) an
 * override. The result is a union: `'granted'` or `{ approval_required: { approval_id } }` —
 * the caller must branch on it, not assume the grant took effect immediately.
 */
export function grantEntitlementOverride(
  client: TypedApiClient,
  tenantId: string,
  body: {
    feature_key: string
    enabled?: boolean
    limit?: number | null
    expires_at?: string | null
    reason?: string | null
  },
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/platform/tenants/{id}/entitlements', body, {
    params: { path: { id: tenantId } },
    ...(signal ? { signal } : {}),
  })
}

/** `DELETE /api/v1/platform/tenants/{id}/entitlements/{feature}` — revoke a stored override. */
export function revokeEntitlementOverride(
  client: TypedApiClient,
  tenantId: string,
  feature: string,
  signal?: AbortSignal,
) {
  return client.DELETE('/api/v1/platform/tenants/{id}/entitlements/{feature}', {
    params: { path: { id: tenantId, feature } },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/platform/tenants/{id}/subscription/override` — pin a tenant to a plan outside Stripe. */
export function applySubscriptionOverride(
  client: TypedApiClient,
  tenantId: string,
  body: { plan_key: string; reason: string },
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/platform/tenants/{id}/subscription/override', body, {
    params: { path: { id: tenantId } },
    ...(signal ? { signal } : {}),
  })
}

/** `DELETE /api/v1/platform/tenants/{id}/subscription/override` — remove the pin, falling back to Stripe. */
export function revokeSubscriptionOverride(
  client: TypedApiClient,
  tenantId: string,
  signal?: AbortSignal,
) {
  return client.DELETE('/api/v1/platform/tenants/{id}/subscription/override', {
    params: { path: { id: tenantId } },
    ...(signal ? { signal } : {}),
  })
}
