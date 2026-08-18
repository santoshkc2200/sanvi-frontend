import { resolveSession } from '@sanvi/auth/server'
import { TenantHostCache, resolveTenantForHost } from '@sanvi/tenant/server'
import { buildContentSecurityPolicyForApp } from '@sanvi/csp'
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
 * Applies the storefront's CSP. Unlike marketing, the storefront is SSR'd
 * per request (tenant/theme/locale vary per request), so this always runs —
 * no adapter-node static-serving bypass to work around. Phase 09 (Tenant
 * Payments) extends `mediaOrigin`/Stripe allowances per tenant; phase 07
 * (Theming) adds the tenant's theme asset origin.
 */
const applyCsp: Handle = async ({ event, resolve }) => {
  const response = await resolve(event)
  const { apiOrigin, mediaOrigin, kratosOrigin } = getAppEnv()

  response.headers.set(
    'content-security-policy',
    buildContentSecurityPolicyForApp('storefront', { apiOrigin, mediaOrigin, kratosOrigin }),
  )

  return response
}

export const handle: Handle = sequence(resolveTenant, resolveLocale, resolveAuth, applyCsp)
