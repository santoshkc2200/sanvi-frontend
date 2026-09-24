import { buildContentSecurityPolicyForApp } from '@sanvi/csp'
import { buildSecurityHeaders, isLocalhostHost } from '@sanvi/csp/security-headers'
import { BASE_LOCALE, ensureLocaleLoaded, parseLocalePrefix } from '@sanvi/i18n'
import { runWithLocale } from '@sanvi/i18n/server'
import type { Handle } from '@sveltejs/kit'
import { getAppEnv } from '$lib/env'

/**
 * Every response gets a real `Content-Security-Policy` header — not an
 * afterthought before launch (docs/architecture-overview.md §8). This is
 * the only place marketing sets it.
 *
 * Covers `vite dev`/`vite preview` and any non-prerendered route (`/health`,
 * `/signup`) in production. Fully prerendered pages served by
 * `adapter-node`'s static middleware bypass `handle` entirely in
 * production — the CDN/reverse proxy in front of the Node service is
 * expected to set the same header there from this same builder, matching
 * the pattern csp's own tests document.
 *
 * Phase 06: the locale is purely path-derived here — no tenant, no cookie
 * negotiation, no redirects. Unprefixed is `en` (the platform default),
 * `/{locale}/…` prefixes are that locale's canonical URL, and the render
 * runs inside `runWithLocale` so `t()` answers per request. Crucially this
 * hook also runs *at prerender time*, which is how the `/ja` variants'
 * prerendered HTML ends up in Japanese with `lang="ja"` — no flash of
 * English, no client-side rewrite.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const locale = parseLocalePrefix(event.url.pathname)?.locale ?? BASE_LOCALE
  await ensureLocaleLoaded(locale)

  const response = await runWithLocale(locale, () =>
    resolve(event, {
      transformPageChunk: ({ html }) => html.replace('lang="en"', `lang="${locale}"`),
    }),
  )

  const { apiOrigin, mediaOrigin } = getAppEnv()
  response.headers.set(
    'content-security-policy',
    buildContentSecurityPolicyForApp('marketing', { apiOrigin, mediaOrigin }),
  )
  response.headers.set('content-language', locale)

  // The backend-specified security headers (NFR-1114) from the shared
  // builder — same posture the API answers with. HSTS stays off for
  // localhost hosts (it pins the hostname, not the port); production's
  // edge sets it the same way the backend's middleware does.
  const securityHeaders = buildSecurityHeaders({
    hsts: !isLocalhostHost(event.request.headers.get('host')),
  })
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value)
  }

  return response
}
