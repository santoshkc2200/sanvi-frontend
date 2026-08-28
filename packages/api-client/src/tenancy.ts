import type { TypedApiClient } from './typed'

/**
 * `GET /api/v1/public/tenant-context` — host-based context for the storefront
 * SSR bootstrap. No auth, no tenant header (the host *is* the tenant hint).
 * 404 → unknown host; a suspended/provisioning/archived tenant still answers
 * 200 (the caller renders the maintenance view from `status`).
 */
export function getPublicTenantContext(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/public/tenant-context', signal ? { signal } : undefined)
}

/**
 * `GET /api/v1/tenant/context` — the current tenant's self-description, as
 * resolved by the backend's tenant-resolution middleware (subdomain, custom
 * domain, or internal header) for this request.
 */
export function getTenantContext(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/context', signal ? { signal } : undefined)
}

/** `GET /api/v1/tenant/settings` — the tenant's key/value settings bag. */
export function getTenantSettings(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/settings', signal ? { signal } : undefined)
}

/**
 * `PUT /api/v1/tenant/settings` — upsert one or more settings. Keys must match
 * `[a-z0-9_.-]{1,64}` (the backend rejects anything else); values are
 * uninterpreted JSON.
 */
export function updateTenantSettings(
  client: TypedApiClient,
  settings: Record<string, unknown>,
  signal?: AbortSignal,
) {
  return client.PUT('/api/v1/tenant/settings', { settings }, signal ? { signal } : undefined)
}

/** `GET /api/v1/public/slug-availability` — check if a tenant slug is available. */
export function checkSlugAvailability(client: TypedApiClient, slug: string, signal?: AbortSignal) {
  return client.GET('/api/v1/public/slug-availability', {
    params: { query: { slug } },
    ...(signal ? { signal } : {}),
  })
}
