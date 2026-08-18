import { getDevMemberships } from './dev-memberships'
import type { TenantMembership } from './types'

/**
 * SPA-only global rune store (same pattern as `packages/ui/src/toast.svelte.ts`)
 * — safe here because admin/platform-admin are one instance per browser tab,
 * unlike the storefront's SSR process which must never hold per-request
 * state in a module singleton (see `context.ts` for that case instead).
 */

const COOKIE_NAME = 'sanvi_tenant'
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365

function readCookieTenantId(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match ? decodeURIComponent(match[1] ?? '') : undefined
}

function writeCookieTenantId(tenantId: string): void {
  if (typeof document === 'undefined') return
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API isn't available in every browser this app supports; a single non-httpOnly preference cookie (no session/tenant data) is the right tool here.
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(tenantId)}; path=/; max-age=${COOKIE_MAX_AGE_S}; samesite=lax`
}

let memberships = $state<TenantMembership[]>(getDevMemberships())
let activeTenantId: string | undefined = $state(
  readCookieTenantId() ?? getDevMemberships()[0]?.tenantId,
)

type SwitchListener = (tenantId: string) => void
let switchListeners: SwitchListener[] = []

export function getMemberships(): TenantMembership[] {
  return memberships
}

/** Test-only escape hatch — production code gets its membership list from `dev-memberships.ts` (and, from phase 02 on, the session). */
export function setMemberships(next: TenantMembership[]): void {
  memberships = next
}

export function getActiveTenantId(): string | undefined {
  return activeTenantId
}

export function getActiveMembership(): TenantMembership | undefined {
  return memberships.find((m) => m.tenantId === activeTenantId)
}

/** Throws instead of returning `undefined` — for components that only render once a tenant is selected. */
export function requireActiveMembership(): TenantMembership {
  const membership = getActiveMembership()
  if (!membership) {
    throw new Error('requireActiveMembership() called with no active tenant selected')
  }
  return membership
}

let entitlements = $state<Record<string, boolean>>({})

/**
 * Cache written from outside this package — same shape as {@link setMemberships}
 * — since `@sanvi/tenant` has no reason to depend on `@sanvi/api-client`
 * directly. The app calls this after `listTenantEntitlements` resolves (and
 * again on every tenant switch), the same way it already calls
 * `setMemberships` after hydrating the session.
 */
export function setEntitlements(features: { feature: string; enabled: boolean }[]): void {
  entitlements = Object.fromEntries(features.map((f) => [f.feature, f.enabled]))
}

/** A feature with no entitlement data yet reads as unavailable, not available — real as of phase 03 (`access.entitlements`), replacing the always-`true` stub earlier phases built against. */
export function hasFeature(key: string): boolean {
  return entitlements[key] ?? false
}

/** Fires after `activeTenantId` and the cookie are updated — wire cache invalidation (e.g. `@sanvi/query`'s `clear()`) here rather than inside this package, which has no reason to depend on the query layer. */
export function onTenantSwitch(listener: SwitchListener): () => void {
  switchListeners = [...switchListeners, listener]
  return () => {
    switchListeners = switchListeners.filter((registered) => registered !== listener)
  }
}

export function switchTenant(tenantId: string): void {
  if (!memberships.some((m) => m.tenantId === tenantId)) {
    throw new Error(`switchTenant: "${tenantId}" is not in the current membership list`)
  }
  activeTenantId = tenantId
  writeCookieTenantId(tenantId)
  for (const listener of switchListeners) listener(tenantId)
}
