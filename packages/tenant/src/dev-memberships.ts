import type { TenantMembership } from './types'

/**
 * Stand-in for `GET /api/v1/me`'s membership list until phase 02 wires real
 * auth into the admin apps — that endpoint 401s without a session today
 * (`sanvi-backend/api/identity.yaml`'s `get_me`), and phase 01's own scope
 * explicitly defers auth. Replace this call site (not this file's shape —
 * `TenantMembership` is what the real response should map to) once phase 02
 * lands.
 */
const DEV_MEMBERSHIPS: TenantMembership[] = [
  { tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme Corporation', role: 'owner' },
  { tenantId: 'dev-globex', slug: 'globex', displayName: 'Globex Industries', role: 'admin' },
]

export function getDevMemberships(): TenantMembership[] {
  return DEV_MEMBERSHIPS
}
