import type { TypedApiClient } from './typed'

/** `GET /api/v1/access/permissions` — the central permission registry. */
export function listPermissions(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/access/permissions', signal ? { signal } : undefined)
}

/** `GET /api/v1/platform/features` — the feature catalog. */
export function listFeatures(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/features', signal ? { signal } : undefined)
}

/** `POST /api/v1/platform/features` — define a new feature. */
export function defineFeature(
  client: TypedApiClient,
  body: {
    key: string
    name: string
    kind: 'boolean' | 'quota'
    default_enabled?: boolean
    default_limit?: number | null
    visibility?: 'public' | 'hidden'
  },
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/platform/features', body, signal ? { signal } : undefined)
}

/** `PATCH /api/v1/platform/features/{key}` — update a feature's defaults/visibility. */
export function updateFeature(
  client: TypedApiClient,
  key: string,
  body: {
    name: string
    default_enabled: boolean
    default_limit?: number | null
    visibility?: 'public' | 'hidden'
  },
  signal?: AbortSignal,
) {
  return client.PATCH('/api/v1/platform/features/{key}', body, {
    params: { path: { key } },
    ...(signal ? { signal } : {}),
  })
}

/** `DELETE /api/v1/platform/features/{key}` — deprecate a feature (stays resolvable, drops from catalogs). */
export function deprecateFeature(client: TypedApiClient, key: string, signal?: AbortSignal) {
  return client.DELETE('/api/v1/platform/features/{key}', {
    params: { path: { key } },
    ...(signal ? { signal } : {}),
  })
}

/** `GET /api/v1/platform/roles` — the platform role catalog. */
export function listRolesPlatform(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/roles', signal ? { signal } : undefined)
}

/** `GET /api/v1/tenant/roles` — the current tenant's assignable roles (system + custom). */
export function listRolesTenant(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/roles', signal ? { signal } : undefined)
}

/** `POST /api/v1/tenant/roles` — author a custom tenant role. The backend independently rejects any permission the actor doesn't itself hold. */
export function createRole(
  client: TypedApiClient,
  body: { key: string; name: string; permissions: string[] },
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/tenant/roles', body, signal ? { signal } : undefined)
}

/** `PATCH /api/v1/tenant/roles/{id}` — rename a custom role or change its permission set. */
export function updateRole(
  client: TypedApiClient,
  roleId: string,
  body: { name?: string | null; permissions?: string[] | null },
  signal?: AbortSignal,
) {
  return client.PATCH('/api/v1/tenant/roles/{id}', body, {
    params: { path: { id: roleId } },
    ...(signal ? { signal } : {}),
  })
}

/** `DELETE /api/v1/tenant/roles/{id}` — delete a custom role (system roles reject this server-side). */
export function deleteRole(client: TypedApiClient, roleId: string, signal?: AbortSignal) {
  return client.DELETE('/api/v1/tenant/roles/{id}', {
    params: { path: { id: roleId } },
    ...(signal ? { signal } : {}),
  })
}

/** `GET /api/v1/tenant/entitlements` — the current tenant's resolved entitlements (with source precedence). */
export function listTenantEntitlements(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/entitlements', signal ? { signal } : undefined)
}
