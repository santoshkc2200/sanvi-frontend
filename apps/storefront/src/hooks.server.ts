import { resolveSession } from '@sanvi/auth/server'
import { TenantHostCache, resolveTenantForHost } from '@sanvi/tenant/server'
import type { Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { getAppEnv } from '$lib/env'

/**
 * Shared across every request on purpose — it caches by host, which is
 * exactly the "per-host, not per-request" scope that makes it safe to share
 * across concurrent requests (see `TenantHostCache`'s own doc comment).
 */
const tenantHostCache = new TenantHostCache()

/**
 * `/health` must answer even when the backend it would otherwise call is
 * down — that's the one thing an orchestrator's liveness probe needs to
 * know, and it can't if answering the probe itself requires the dependency
 * being probed for. Every hook that talks to the API checks this first.
 */
function isHealthCheck(pathname: string): boolean {
  return pathname === '/health'
}

/**
 * Resolves the tenant from the request's `Host` header via
 * `@sanvi/tenant/server`'s TTL + stale-while-revalidate cache. Unknown host
 * → `locals.tenant = null`, `locals.tenantResolution = 'unknown-host'`
 * (the root `+layout.server.ts` turns that into a 404, never an enumeration
 * signal). A suspended/provisioning/archived tenant still resolves `'ok'` —
 * the root layout renders the maintenance branch from `tenant.status`.
 */
export const resolveTenant: Handle = async ({ event, resolve }) => {
  if (isHealthCheck(event.url.pathname)) return resolve(event)

  const host = event.request.headers.get('host') ?? event.url.host
  const { apiOrigin } = getAppEnv()

  const resolution = await resolveTenantForHost(tenantHostCache, { apiOrigin, host })
  event.locals.tenant = resolution.tenant
  event.locals.tenantResolution = resolution.status

  return resolve(event)
}

/**
 * Resolves the request's locale from `Accept-Language`/a cookie. Phase 06
 * (i18n) replaces this; phase 00 hardcodes `en` so every downstream read of
 * `event.locals.locale` is already typed and non-optional.
 */
const resolveLocale: Handle = async ({ event, resolve }) => {
  event.locals.locale = 'en'
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('lang="en"', `lang="${event.locals.locale}"`),
  })
}

/**
 * Resolves the signed-in session from the request's `Cookie` header — a
 * fresh per-request client (see `@sanvi/auth/server`'s `resolveSession` doc
 * comment for why this, unlike `tenantHostCache` above, is never shared
 * across requests). `null` on 401 (signed out); any other failure bubbles
 * up as a 500 rather than silently rendering as signed-out.
 */
const resolveAuth: Handle = async ({ event, resolve }) => {
  if (isHealthCheck(event.url.pathname)) return resolve(event)

  const { apiOrigin } = getAppEnv()
  event.locals.session = await resolveSession({
    apiOrigin,
    cookieHeader: event.request.headers.get('cookie'),
  })
  return resolve(event)
}

/**
 * The CSP is NOT set here: it comes from `kit.csp` in `svelte.config.js`
 * (policy still defined by `@sanvi/csp`, but in the directive-record shape
 * SvelteKit consumes). SvelteKit must own the header because it stamps its
 * per-request inline hydration/bootstrap scripts with the matching hashes —
 * a statically-built `script-src 'self'` header would block those scripts
 * and disable all client-side behaviour. See `svelte.config.js` for the
 * build-time-origin trade-off this involves.
 */
export const handle: Handle = sequence(resolveTenant, resolveLocale, resolveAuth)
