import { env } from '$env/dynamic/public'

export interface AppEnv {
  apiOrigin: string
  mediaOrigin: string | undefined
  themeAssetOrigin: string | undefined
  /** Ory Kratos's public API origin — `@sanvi/auth` calls it directly from the browser. */
  kratosOrigin: string
  /**
   * Site key for the same-origin conversion beacon (`/api/v1/public/track`).
   * Optional: the backend's `/public/track` answers an uninformative `202`
   * without a verifiable key, so a deployment without one simply captures
   * nothing. Per-tenant delivery from the backend is still an open
   * cross-repo item (see TASK-014 notes); single-tenant deployments and the
   * e2e harness set it as a runtime env var.
   */
  trackingSiteKey: string | undefined
}

let cached: AppEnv | undefined

/**
 * `$env/dynamic/public`, not `.../private` — see marketing's identical
 * `env.ts` for why: `PUBLIC_`-prefixed vars belong in the public module,
 * and only the public one is populated during prerendering.
 */
export function getAppEnv(): AppEnv {
  if (cached) return cached

  const apiOrigin = env['PUBLIC_API_ORIGIN']
  if (!apiOrigin) {
    throw new Error('PUBLIC_API_ORIGIN is required but was not set.')
  }
  const kratosOrigin = env['PUBLIC_KRATOS_ORIGIN']
  if (!kratosOrigin) {
    throw new Error('PUBLIC_KRATOS_ORIGIN is required but was not set.')
  }

  cached = {
    apiOrigin,
    mediaOrigin: env['PUBLIC_MEDIA_ORIGIN'] || undefined,
    themeAssetOrigin: env['PUBLIC_THEME_ASSET_ORIGIN'] || undefined,
    kratosOrigin,
    trackingSiteKey: env['PUBLIC_TRACKING_SITE_KEY'] || undefined,
  }
  return cached
}
