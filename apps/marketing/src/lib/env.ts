import { env } from '$env/dynamic/public'

export interface AppEnv {
  apiOrigin: string
  mediaOrigin: string | undefined
}

let cached: AppEnv | undefined

/**
 * Reads and validates env vars at request time (not build time — the Node
 * adapter deploys one image per environment, so vars are injected at
 * container start, not baked in). Throws on first read if misconfigured,
 * which fails fast in a health check rather than surfacing as a confusing
 * downstream CSP/fetch error.
 *
 * `$env/dynamic/public`, not `.../private` — these vars are `PUBLIC_`-
 * prefixed by SvelteKit convention specifically because they're safe to
 * expose to the client (an API origin, not a secret), and the private
 * module isn't populated during prerendering (this route runs at build
 * time to produce static HTML), which the public one is.
 */
export function getAppEnv(): AppEnv {
  if (cached) return cached

  const apiOrigin = env['PUBLIC_API_ORIGIN']
  if (!apiOrigin) {
    throw new Error('PUBLIC_API_ORIGIN is required but was not set.')
  }

  cached = { apiOrigin, mediaOrigin: env['PUBLIC_MEDIA_ORIGIN'] || undefined }
  return cached
}
