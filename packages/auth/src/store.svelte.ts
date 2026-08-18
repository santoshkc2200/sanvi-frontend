import type { ApiClient, TypedApiClient } from '@sanvi/api-client'
import { requestLogoutUrl } from './kratos/flow'
import { hydrateSession } from './session'
import type { Session } from './session'

/**
 * SPA-only global rune store — same shape and the same reasoning as
 * `@sanvi/tenant`'s `store.svelte.ts`: safe here because `admin` and
 * `platform-admin` are one instance per browser tab. The storefront's SSR
 * process uses `context.ts` instead (a module singleton there would leak
 * one request's session into another's response).
 */

let session: Session | null = $state(null)
let hydrated = $state(false)

type ChangeListener = (session: Session | null) => void
let changeListeners: ChangeListener[] = []

export function getSession(): Session | null {
  return session
}

/** `false` until the first `bootSession`/`setSession` call resolves — guards render a spinner, not a sign-in redirect, while this is still `false`. */
export function isSessionHydrated(): boolean {
  return hydrated
}

export function setSession(next: Session | null): void {
  session = next
  hydrated = true
  for (const listener of changeListeners) listener(next)
}

/** Fetches `/me` + `/me/sessions` and populates the store — call once at SPA boot. */
export async function bootSession(client: TypedApiClient): Promise<Session | null> {
  const next = await hydrateSession(client)
  setSession(next)
  return next
}

/**
 * Fires whenever the session changes (boot, login, logout, 401 refresh) —
 * wire cache invalidation (`@sanvi/query`'s `clearCache()`) and tenant-store
 * resets here, in the app, rather than inside this package (same inversion
 * `@sanvi/tenant`'s `onTenantSwitch` uses, for the same reason: this package
 * has no reason to depend on the query or tenant layers).
 */
export function onSessionChange(listener: ChangeListener): () => void {
  changeListeners = [...changeListeners, listener]
  return () => {
    changeListeners = changeListeners.filter((registered) => registered !== listener)
  }
}

/**
 * Ends the Kratos session via its own logout flow — a real navigation to
 * `logout_url`, not a fetch, so the browser processes Kratos's cookie-
 * clearing response and its own `after.default_browser_return_url` redirect
 * the normal way. "Sign out everywhere" is the same call today: the backend
 * currently reports only the caller's own current session (see
 * `sanvi-backend/api/identity.yaml`'s `list_sessions`), so there is nothing
 * else to end yet — this becomes real multi-session revocation without a
 * frontend change once that lands.
 */
export async function logout(kratosClient: ApiClient): Promise<void> {
  const logoutUrl = await requestLogoutUrl(kratosClient)
  setSession(null)
  if (typeof window !== 'undefined') window.location.href = logoutUrl
}

let lastDeniedPermission: string | undefined = $state(undefined)

/** Set by `guards.ts`'s `requirePermission` on a denial — read by the app's `guardRejected` branch to name which permission is missing (the phase-02 acceptance criterion: the 403 explains *what*, not just *no*). */
export function getLastDeniedPermission(): string | undefined {
  return lastDeniedPermission
}

export function setLastDeniedPermission(permission: string | undefined): void {
  lastDeniedPermission = permission
}
