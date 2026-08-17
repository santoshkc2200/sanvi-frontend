import { getContext, hasContext, setContext } from 'svelte'
import type { TenantContext } from './types'

const KEY = Symbol('sanvi.tenant')

/**
 * SSR-safe: Svelte's context API is per-component-tree, so this never leaks
 * across concurrent server requests the way a module-level store would.
 * Call once from the storefront's root `+layout.svelte`.
 */
export function setTenantContext(tenant: TenantContext | null): void {
  setContext(KEY, tenant)
}

export function getTenantContext(): TenantContext | null {
  return hasContext(KEY) ? (getContext(KEY) as TenantContext | null) : null
}

/** Throws instead of returning `null` — for components that only render inside a resolved-tenant subtree (never the 404/maintenance branches). */
export function requireTenantContext(): TenantContext {
  const tenant = getTenantContext()
  if (!tenant) {
    throw new Error('requireTenantContext() called outside a resolved tenant context')
  }
  return tenant
}
