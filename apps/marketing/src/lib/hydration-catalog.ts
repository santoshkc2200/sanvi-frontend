import { BASE_LOCALE, ensureLocaleLoaded, parseLocalePrefix } from '@sanvi/i18n'
import { registerMarketingSurface } from '@sanvi/i18n/surfaces/marketing'

/**
 * TASK-022: hydration must not replay a `t()` against an empty catalog —
 * the same module-scope top-level await the storefront's
 * `$lib/hydration-catalog` documents in full. Registrar before await
 * (ordering is load-bearing), holds hydration until the URL's lazy ja
 * shards are in so prop replays compute the prerendered strings; en
 * resolves synchronously, the prerender server immediately. Requires the
 * es2022 build target (see `vite.config.ts`).
 */
registerMarketingSurface()

if (typeof location !== 'undefined') {
  await ensureLocaleLoaded(parseLocalePrefix(location.pathname)?.locale ?? BASE_LOCALE)
}
