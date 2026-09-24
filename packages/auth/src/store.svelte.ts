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
 * Re-hydrates the store from `/me` + `/me/sessions` — the half of the
 * phase-02 session-state decision ("hydrated on boot, refreshed on focus
 * and on 401") that keeps the store true as the session changes underneath
 * an open tab: revoked on another device, stepped up to `aal2`, expired.
 * The 401 half is the api-client `onUnauthorized` hook the apps wire to
 * {@link setSession}.
 */
export async function refreshSession(client: TypedApiClient): Promise<Session | null> {
  const next = await hydrateSession(client)
  setSession(next)
  return next
}

export interface SessionAutoRefreshOptions {
  /** Focus and `visibilitychange` can fire for the same return to the tab — this collapses them. @default 30_000 */
  minIntervalMs?: number
}

/**
 * Refreshes the session whenever the tab regains focus — the moment a
 * change made elsewhere (revocation on another device, a step-up completed
 * in another tab) becomes observable. A change made *in* this tab (a 401
 * from any API call) is caught sooner by the `onUnauthorized` hook instead.
 * A failed refresh keeps the last-known session: "network hiccup" and
 * "signed out" are different states, and the next focus retries.
 *
 * Returns a disposer; no-op off the browser. Call once at SPA boot, after
 * `bootSession` (see `apps/admin/src/main.ts`).
 */
export function startSessionAutoRefresh(
  client: TypedApiClient,
  options: SessionAutoRefreshOptions = {},
): () => void {
  const minIntervalMs = options.minIntervalMs ?? 30_000
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}

  let lastStartedAt = 0
  let inFlight: Promise<Session | null> | undefined

  const refresh = (): void => {
    if (document.visibilityState !== 'visible') return
    if (inFlight || Date.now() - lastStartedAt < minIntervalMs) return
    lastStartedAt = Date.now()
    inFlight = refreshSession(client)
      .catch(() => null)
      .finally(() => {
        inFlight = undefined
      })
  }

  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', refresh)
  return () => {
    window.removeEventListener('focus', refresh)
    document.removeEventListener('visibilitychange', refresh)
  }
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
 *
 * Other open tabs learn about the sign-out immediately through the
 * {@link SESSION_CHANNEL_NAME} broadcast (TASK-024): without it, a second
 * tab kept its in-memory session until its next API call 401'd or its next
 * focus-triggered refresh — a window where a signed-out tenant's screens
 * still rendered from cache. The receiving tab runs the same
 * `onSessionChange` listeners the app wired for a local logout, so cache
 * clears and membership resets happen there too.
 */
export const SESSION_CHANNEL_NAME = 'sanvi:auth'

interface SessionBroadcast {
  type: 'signed-out'
}

let sessionChannelInstance: BroadcastChannel | undefined

/**
 * The cross-tab channel, created lazily and only where `BroadcastChannel`
 * exists (browsers; jsdom and SSR stay without). Receiving `signed-out`
 * applies the null session locally — it must not re-broadcast, or two tabs
 * would ping-pong the message forever.
 */
function sessionChannel(): BroadcastChannel | undefined {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return undefined
  sessionChannelInstance ??= new BroadcastChannel(SESSION_CHANNEL_NAME)
  sessionChannelInstance.onmessage = (event: MessageEvent) => {
    const data = event.data as SessionBroadcast | undefined
    if (data?.type === 'signed-out') setSession(null)
  }
  return sessionChannelInstance
}

// Installed at module init, not lazily inside `logout()`: a tab that never
// logs itself out must still *hear* another tab's logout — that is the whole
// point of the channel.
sessionChannel()

export async function logout(kratosClient: ApiClient): Promise<void> {
  const logoutUrl = await requestLogoutUrl(kratosClient)
  setSession(null)
  sessionChannel()?.postMessage({ type: 'signed-out' } satisfies SessionBroadcast)
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
