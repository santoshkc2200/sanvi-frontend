import { createApiClient, createTypedApiClient, getPublicTheme } from '@sanvi/api-client'
import { resolveSession } from '@sanvi/auth/server'
import { buildContentSecurityPolicyDirectivesForApp } from '@sanvi/csp'
import {
  BASE_LOCALE,
  LOCALE_COOKIE,
  ensureLocaleLoaded,
  normalizeLocaleTag,
  type Locale,
  parseLocalePrefix,
  withLocalePrefix,
} from '@sanvi/i18n'
import { resolveRequestLocale, runWithLocale } from '@sanvi/i18n/server'
import { TenantHostCache, resolveTenantForHost } from '@sanvi/tenant/server'
import { DEFAULT_FALLBACK_THEME, getCachedTheme, setCachedTheme } from '@sanvi/theme-runtime'
import type { Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { getAppEnv } from '$lib/env'
import { getAvailableLocales } from '$lib/locales.server'

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
 * Resolves the signed-in session from the request's `Cookie` header — a
 * fresh per-request client (see `@sanvi/auth/server`'s `resolveSession` doc
 * comment for why this, unlike `tenantHostCache` above, is never shared
 * across requests). `null` on 401 (signed out); any other failure bubbles
 * up as a 500 rather than silently rendering as signed-out.
 *
 * Runs *before* locale resolution: the locale chain's "account preference"
 * leg reads `locals.session.locale` (`MeView.locale`).
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
 * Resolves the active theme for the tenant/host from `GET /api/v1/public/theme`
 * via `@sanvi/theme-runtime`'s host/locale cache.
 *
 * Never throws and never blocks the response: any failure (network error,
 * non-2xx status, timeout, malformed payload) degrades to
 * `DEFAULT_FALLBACK_THEME` and logs.
 */
export const resolveTheme: Handle = async ({ event, resolve }) => {
  if (isHealthCheck(event.url.pathname)) return resolve(event)

  const host = event.request.headers.get('host') ?? event.url.host
  const locale = event.locals.locale ?? event.locals.tenant?.default_locale ?? 'en'
  const cacheKey = `${host}:${locale}`

  const cached = getCachedTheme(cacheKey)
  if (cached) {
    event.locals.theme = cached
    return resolve(event)
  }

  try {
    const { apiOrigin } = getAppEnv()
    const client = createTypedApiClient(
      createApiClient({
        baseUrl: apiOrigin,
        getTenantId: () => event.locals.tenant?.tenant_id,
        getExtraHeaders: () => ({ host }),
      }),
    )

    const theme = await getPublicTheme(client, { host, locale })
    if (theme && typeof theme === 'object' && 'theme_key' in theme) {
      setCachedTheme(cacheKey, theme)
      event.locals.theme = theme
    } else {
      event.locals.theme = DEFAULT_FALLBACK_THEME
    }
  } catch (error) {
    console.error('Failed to resolve theme, falling back to default:', error)
    event.locals.theme = DEFAULT_FALLBACK_THEME
  }

  return resolve(event)
}

/**
 * Which requests may get locale-canonicalizing redirects. Data requests and
 * anything asset-shaped (a `.` in the last segment) must pass through
 * untouched — a 307 on `/_app/immutable/…` or `favicon.svg` would be
 * nonsense, and `__data.json` needs to answer for the URL it was built for.
 */
function isRedirectCandidate(event: {
  request: Request
  isDataRequest: boolean
  url: URL
}): boolean {
  if (event.request.method !== 'GET' && event.request.method !== 'HEAD') return false
  if (event.isDataRequest) return false
  const lastSegment = event.url.pathname.split('/').pop() ?? ''
  return !lastSegment.includes('.')
}

/**
 * Phase 06's locale resolution — the frontend half of the backend's
 * negotiation order (`@sanvi/i18n/server`'s `resolveRequestLocale`), plus
 * the URL canonicalization the SEO model needs:
 *
 * - `/{locale}/…` prefixes are honored for every available locale; a prefix
 *   in the *tenant default* locale is a duplicate of the canonical
 *   unprefixed URL and 308-redirects to it.
 * - An unprefixed URL where negotiation picked a non-default locale (via
 *   switcher cookie, account preference, or `Accept-Language`) 307s to the
 *   prefixed canonical URL — SSR HTML never renders a language that
 *   disagrees with its own canonical link, and a Japanese reader landing on
 *   `/` never sees a flash of English.
 * - The tenant default itself needs no redirect: unprefixed *is* its
 *   canonical form.
 *
 * The render runs inside `runWithLocale`, so every `t()`/`fmt()` call in
 * this request's components and load functions reads this locale from the
 * request's AsyncLocalStorage — per-request state, never a module global.
 */
export const resolveLocale: Handle = async ({ event, resolve }) => {
  if (isHealthCheck(event.url.pathname)) return resolve(event)

  const available = getAvailableLocales()
  const tenantDefault: Locale =
    normalizeLocaleTag(event.locals.tenant?.default_locale) ?? BASE_LOCALE
  const prefix = parseLocalePrefix(event.url.pathname, available)

  if (prefix && isRedirectCandidate(event) && prefix.locale === tenantDefault) {
    // `/en/privacy` (default-locale prefix) → `/privacy`: one canonical URL per page.
    return new Response(null, {
      status: 308,
      headers: { location: prefix.rest + event.url.search },
    })
  }

  if (!prefix && isRedirectCandidate(event)) {
    const negotiated = resolveRequestLocale({
      pathname: event.url.pathname,
      cookieLocale: event.cookies.get(LOCALE_COOKIE),
      sessionLocale: event.locals.session?.locale ?? null,
      tenantDefaultLocale: event.locals.tenant?.default_locale ?? null,
      acceptLanguage: event.request.headers.get('accept-language'),
      available,
    })
    if (negotiated.locale !== tenantDefault) {
      const target = withLocalePrefix(event.url.pathname, negotiated.locale, tenantDefault)
      return new Response(null, {
        status: 307,
        headers: { location: target + event.url.search, vary: 'accept-language, cookie' },
      })
    }
  }

  const locale = prefix?.locale ?? tenantDefault
  event.locals.locale = locale
  await ensureLocaleLoaded(locale)

  const response = await runWithLocale(locale, () =>
    resolve(event, {
      transformPageChunk: ({ html }) => html.replace('lang="en"', `lang="${locale}"`),
    }),
  )
  response.headers.set('content-language', locale)
  const vary = response.headers.get('vary')
  if (!vary?.toLowerCase().includes('accept-language')) {
    response.headers.set('vary', vary ? `${vary}, accept-language` : 'accept-language')
  }
  return response
}

/**
 * The CSP header is *emitted* by `kit.csp` (see `svelte.config.js`): SvelteKit
 * hashes its own inline hydration scripts per request, which a static header
 * can't know. But kit freezes `connect-src` and theme origins at *build* time,
 * while the origins are runtime env — so the header is rewritten here, on the
 * way out, with the runtime origins. Everything else stays as kit built it.
 */
const CONNECT_SRC = 'connect-src'

export const runtimeConnectSrc: Handle = async ({ event, resolve }) => {
  const response = await resolve(event)
  const header = response.headers.get('content-security-policy')
  if (!header) return response

  const { apiOrigin, mediaOrigin, themeAssetOrigin, kratosOrigin } = getAppEnv()
  const runtime = buildContentSecurityPolicyDirectivesForApp('storefront', {
    apiOrigin,
    mediaOrigin,
    themeAssetOrigin,
    kratosOrigin,
  })[CONNECT_SRC]

  const rewritten = header
    .split(';')
    .map((directive) => {
      const trimmed = directive.trim()
      if (!trimmed) return ''

      if (trimmed.startsWith(`${CONNECT_SRC} `) || trimmed === CONNECT_SRC) {
        return runtime?.length ? `${CONNECT_SRC} ${runtime.join(' ')}` : trimmed
      }

      const match = /^([a-z-]+)\s+(.*)$/i.exec(trimmed)
      if (match && themeAssetOrigin) {
        const name = match[1]
        const sources = match[2]
        if (name && sources && ['style-src', 'img-src', 'font-src'].includes(name)) {
          const sourceList = sources.split(/\s+/).filter(Boolean)
          if (!sourceList.includes(themeAssetOrigin)) {
            sourceList.push(themeAssetOrigin)
          }
          return `${name} ${sourceList.join(' ')}`
        }
      }

      return trimmed
    })
    .filter(Boolean)
    .join('; ')
  response.headers.set('content-security-policy', rewritten)
  return response
}

export const handle: Handle = sequence(
  resolveTenant,
  resolveAuth,
  resolveLocale,
  resolveTheme,
  runtimeConnectSrc,
)
