import { getSession } from './store.svelte'
import type { Session } from './session'
import { membershipFor } from './session'

/**
 * Pure permission check against one membership's effective permission list
 * — a UX hint only ("hide a button the caller can't use"), never the
 * enforcement: the backend independently checks every mutation with its own
 * `require_permission!` guard, and continues to do so regardless of what
 * this returns. `tenantId` defaults to the session's first membership when
 * omitted, the common case for single-tenant staff.
 */
export function hasPermission(
  session: Session | null,
  permission: string,
  tenantId?: string,
): boolean {
  if (!session) return false
  const targetTenantId = tenantId ?? session.memberships[0]?.tenant_id
  if (!targetTenantId) return false
  const membership = membershipFor(session, targetTenantId)
  return membership?.permissions.includes(permission) ?? false
}

/**
 * Ambient convenience for the SPA apps (`admin`, `platform-admin`), reading
 * the module-singleton session store from `store.svelte.ts`. SSR apps
 * (`storefront`) don't currently render permission-gated UI (see the phase-
 * 02 plan's "who authenticates where") — if that changes, call
 * {@link hasPermission} directly against the SSR `context.ts` session
 * instead of adding ambient state to the SSR path.
 */
export function can(permission: string, tenantId?: string): boolean {
  return hasPermission(getSession(), permission, tenantId)
}
