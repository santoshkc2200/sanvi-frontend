import type { Router, RouteParams } from '@sanvi/spa-router'
import { hasPermission } from './can'
import { getSession, setLastDeniedPermission } from './store.svelte'
import type { Session } from './session'

const RETURN_TO_PARAM = 'return_to'

/**
 * `/login?return_to=<here>` — `return_to` is validated against our own-host
 * allow-list at the point it's actually used (`kratos/flow.ts`'s
 * `startFlow`), not here; this only builds a same-app relative path, which
 * is trivially in-bounds.
 */
function loginPathWithReturnTo(router: Router): string {
  const search = typeof window === 'undefined' ? '' : window.location.search
  return `/login?${RETURN_TO_PARAM}=${encodeURIComponent(router.pathname + search)}`
}

/**
 * `RouteDefinition['guard']` factory for the SPA apps. Assumes
 * `bootSession()` has already resolved by the time any route resolves — the
 * app's `main.ts` awaits it before mounting the router (see
 * `apps/admin/src/main.ts`) — so there is no "still loading" state to
 * special-case here; `Router#resolve` never calls the matched route's
 * `load()` when this returns `false`, so no protected content can flash.
 */
export function requireSession(
  router: Router,
  loginPath: (router: Router) => string = loginPathWithReturnTo,
) {
  return async (_params: RouteParams): Promise<boolean> => {
    if (getSession()) return true
    router.navigate(loginPath(router))
    return false
  }
}

/** `requireSession`, plus a specific permission — the denial is recorded (`getLastDeniedPermission`) so the app's 403 view can name it. */
export function requirePermission(router: Router, permission: string, tenantId?: string) {
  const base = requireSession(router)
  return async (params: RouteParams): Promise<boolean> => {
    if (!(await base(params))) return false
    if (hasPermission(getSession(), permission, tenantId)) {
      setLastDeniedPermission(undefined)
      return true
    }
    setLastDeniedPermission(permission)
    return false
  }
}

/** `platform-admin`'s entry requirement: a session that has stepped up to `aal2`, not just signed in. Routes to `stepUpPath` (a re-authentication screen) rather than sign-in when a session exists but hasn't stepped up. */
export function requireAal2(router: Router, stepUpPath = '/step-up') {
  const base = requireSession(router)
  return async (params: RouteParams): Promise<boolean> => {
    if (!(await base(params))) return false
    if (getSession()?.aal === 'aal2') return true
    const search = typeof window === 'undefined' ? '' : window.location.search
    router.navigate(
      `${stepUpPath}?${RETURN_TO_PARAM}=${encodeURIComponent(router.pathname + search)}`,
    )
    return false
  }
}

/**
 * The backend's freshness rule, computed on the same data it uses: an `aal2`
 * session whose `authenticated_at` is within `maxAgeSecs` of `now`
 * (backend default 300s — `crates/platform/http/src/authn.rs`'s
 * `FreshAal2Policy`). Money-adjacent mutations (ad connections, payments
 * disconnect) check this *before* offering the destructive control, so the
 * user is sent to step-up rather than shown a bare 403 after the fact.
 *
 * A session without `authenticated_at` is never fresh: absence of evidence
 * is the stale case, not the fresh one.
 */
export function hasFreshAal2(
  session: Pick<Session, 'aal' | 'authenticatedAt'> | null | undefined,
  now: number = Date.now(),
  maxAgeSecs = 300,
): boolean {
  if (session?.aal !== 'aal2' || !session.authenticatedAt) return false
  const authenticatedAt = Date.parse(session.authenticatedAt)
  if (!Number.isFinite(authenticatedAt)) return false
  return now - authenticatedAt <= maxAgeSecs * 1000
}
