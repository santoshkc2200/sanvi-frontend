import { registerCatalogSurface, toShard } from '../catalogs'
import enCommon from '../../messages/en/common.json'
import enErrors from '../../messages/en/errors.json'
import enMarketing from '../../messages/en/marketing.json'

/**
 * The marketing site's catalog surface (TASK-032): its own copy plus shared
 * chrome and error strings. Nothing else — the marketing site renders no
 * admin, platform, storefront or privacy screens, and historically paid for
 * all of them in its initial bundle.
 *
 * Registered by `apps/marketing` in `hooks.server.ts` (which also runs at
 * prerender time) and the root `+layout.svelte`, before the first `t()` call.
 */
export function registerMarketingSurface(): void {
  registerCatalogSurface('marketing', {
    en: [enCommon, enErrors, enMarketing],
    loadJa: async () =>
      (
        await Promise.all([
          import('../../messages/ja/common.json'),
          import('../../messages/ja/errors.json'),
          import('../../messages/ja/marketing.json'),
        ])
      ).map(toShard),
  })
}
