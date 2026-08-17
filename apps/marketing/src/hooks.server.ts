import { buildContentSecurityPolicyForApp } from '@sanvi/csp'
import type { Handle } from '@sveltejs/kit'
import { getAppEnv } from '$lib/env'

/**
 * Every response gets a real `Content-Security-Policy` header — not an
 * afterthought before launch (docs/architecture-overview.md §8). This is
 * the only place marketing sets it.
 *
 * Covers `vite dev`/`vite preview` and any non-prerendered route (`/health`,
 * and any future route that opts out of prerendering) in production. Fully
 * prerendered pages served by `adapter-node`'s static middleware bypass
 * `handle` entirely in production — the CDN/reverse proxy in front of the
 * Node service is expected to set the same header there from this same
 * builder, matching the pattern csp's own tests document.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event)
  const { apiOrigin, mediaOrigin } = getAppEnv()

  response.headers.set(
    'content-security-policy',
    buildContentSecurityPolicyForApp('marketing', { apiOrigin, mediaOrigin }),
  )

  return response
}
