/**
 * Server-only entry point (`@sanvi/auth/server`) — kept out of the default
 * export map for the same reason `@sanvi/tenant/server` is: only
 * `apps/storefront/src/hooks.server.ts` (and its `load` functions) should
 * import from here.
 */
import { createApiClient, createTypedApiClient } from '@sanvi/api-client'
import { hydrateSession } from './session'
import type { Session } from './session'

export interface ResolveSessionOptions {
  apiOrigin: string
  /**
   * The incoming request's raw `Cookie` header. SvelteKit's server-side
   * `fetch` doesn't forward the browser's cookies to a different origin
   * automatically — `hooks.server.ts` must read it off `event.request` and
   * pass it through explicitly, the same shape `@sanvi/tenant/server`'s
   * host-forwarding code needs for the `Host` header.
   */
  cookieHeader: string | null
}

/**
 * Builds a fresh per-request client that forwards the browser's session
 * cookie, then hydrates the session the same way `bootSession` does for the
 * SPA apps (`GET /me` + `GET /me/sessions`, `null` on 401). One instance per
 * call — never shared across requests, unlike `@sanvi/tenant/server`'s
 * `TenantHostCache` (that cache is keyed by host, safe to share; a session
 * is keyed by *who's asking*, so it never is).
 */
export async function resolveSession(options: ResolveSessionOptions): Promise<Session | null> {
  const client = createTypedApiClient(
    createApiClient({
      baseUrl: options.apiOrigin,
      getExtraHeaders: () => (options.cookieHeader ? { cookie: options.cookieHeader } : undefined),
    }),
  )
  return hydrateSession(client)
}

export type { MembershipSummary, Session } from './session'
