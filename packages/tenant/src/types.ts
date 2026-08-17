import type { components } from '@sanvi/api-client'

/** Re-exported from the generated OpenAPI schema rather than hand-duplicated — see `sanvi-backend/crates/platform/http/src/tenancy.rs`'s `TenantContext`. */
export type TenantContext = components['schemas']['TenantContext']
export type TenantRuntimeStatus = components['schemas']['TenantRuntimeStatus']
export type ResolutionSource = components['schemas']['ResolutionSource']

/** A staff member's membership in one tenant — what the admin tenant switcher lists. Real shape lands in phase 02 with `GET /api/v1/me`; see `dev-memberships.ts`. */
export interface TenantMembership {
  tenantId: string
  slug: string
  displayName: string
  role: string
}
