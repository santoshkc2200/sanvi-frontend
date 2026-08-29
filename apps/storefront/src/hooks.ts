import type { Reroute } from '@sveltejs/kit'
import { parseLocalePrefix } from './lib/locale-prefix.mjs'

/**
 * Phase 06 locale routing: `/{locale}/…` URLs resolve to the same routes as
 * their unprefixed forms — `/ja/privacy` *is* the privacy route, rendered in
 * Japanese. Route files stay unprefixed (no `[locale]` restructure); the
 * prefix exists for canonical/`hreflang` SEO and for the visitor, and is
 * stripped here before kit resolves the route — on the server *and* in the
 * client-side router (this file, unlike `hooks.server.ts`, runs in both),
 * which is what keeps `<a href="/ja/privacy">` navigation SPA-fast.
 *
 * Only configured locales match, so a real route can never collide with a
 * prefix (`/login` is not a locale); anything else falls through to the
 * app's own 404. Request-time redirects (default-locale dedupe,
 * cookie/Accept-Language canonicalization) live in `hooks.server.ts`'s
 * `resolveLocale`, not here.
 *
 * `locale-prefix.mjs` is the dependency-free mirror of `@sanvi/i18n`'s
 * routing module this config-adjacent context needs (its doc comment has
 * the details; the sync test guards the pair).
 */
export const reroute: Reroute = ({ url }) => {
  const prefix = parseLocalePrefix(url.pathname)
  if (!prefix) return
  // The query string rides along — kit swaps only the path.
  return prefix.rest === '' ? '/' : prefix.rest
}
