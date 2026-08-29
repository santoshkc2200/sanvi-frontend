import type { Reroute } from '@sveltejs/kit'
import { parseLocalePrefix } from './lib/locale-prefix.mjs'

/**
 * Phase 06 locale routing: `/{locale}/…` URLs resolve to the same routes as
 * their unprefixed forms — `/ja/pricing` *is* the pricing route, rendered in
 * Japanese. Route files stay unprefixed; the prefix is stripped here before
 * kit resolves the route, on the server and in the client router alike.
 * Unprefixed URLs are the platform default locale's canonical form (`en`):
 * marketing has no tenant, no cookie negotiation, and no redirects — the
 * prerendered pages *are* the canonical URLs for their path+locale pair.
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
