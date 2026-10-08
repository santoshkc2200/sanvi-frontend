import { BASE_LOCALE, ensureLocaleLoaded, normalizeLocaleTag } from '@sanvi/i18n'
import { registerStorefrontSurface } from '@sanvi/i18n/surfaces/storefront'

/**
 * TASK-022: hydration must not replay a `t()` against an empty catalog.
 *
 * The ja catalog is a lazy chunk (TASK-032); evaluating the root layout's
 * localized props before it lands produced English values that patched the
 * SSR'd Japanese DOM — the consent banner visibly flipped languages and
 * re-flowed (the ja CLS 0.1369/0.14–0.18 in the rc.1/rc.3 baselines, and
 * the en-flash behind the storefront locale e2e failures recorded since
 * TASK-014). The module-scope top-level await holds this module — and
 * hydration, whose component modules import it before mounting anything —
 * until the URL's locale shards are in, so every prop replay computes the
 * same strings the server rendered.
 *
 * Ordering is load-bearing: the surface registrar must run *before* the
 * await, or `ensureLocaleLoaded` resolves vacuously with no loaders
 * registered. En pages resolve synchronously (the base catalog is bundled);
 * the server resolves immediately (the hook registers shards at module
 * scope; `location` is undefined there). Client-side navigations are
 * covered by the root `+layout.ts`, which SvelteKit re-runs per navigation.
 * Requires the es2022 build target (see `vite.config.ts`).
 */
registerStorefrontSurface()

if (typeof location !== 'undefined') {
  await ensureLocaleLoaded(normalizeLocaleTag(location.pathname.split('/')[1]) ?? BASE_LOCALE)
}
