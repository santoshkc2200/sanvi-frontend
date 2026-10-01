import { registerCatalogSurface, toShard } from '../catalogs'
import enAuth from '../../messages/en/auth.json'
import enCommon from '../../messages/en/common.json'
import enConsent from '../../messages/en/consent.json'
import enErrors from '../../messages/en/errors.json'
import enLegal from '../../messages/en/legal.json'
import enPrivacy from '../../messages/en/privacy.json'
import enSettings from '../../messages/en/settings.json'
import enStorefront from '../../messages/en/storefront.json'
import enThemeblocks from '../../messages/en/themeblocks.json'

/**
 * The storefront's catalog surface (TASK-032): every shard its screens and
 * packages render — its own copy, the privacy centre, consent, the legal
 * pages, auth flows, account settings, shared chrome, and the theme-blocks
 * library's strings (`@sanvi/theme-blocks` renders only here). Deliberately
 * **not** included: `admin`, `platform`, `payments` (admin-console concerns)
 * and `marketing`.
 *
 * Registered by `apps/storefront` in `hooks.server.ts` (server bundle) and
 * the root `+layout.svelte` (client bundle), before the first `t()` call.
 */
export function registerStorefrontSurface(): void {
  registerCatalogSurface('storefront', {
    en: [
      enAuth,
      enCommon,
      enConsent,
      enErrors,
      enLegal,
      enPrivacy,
      enSettings,
      enStorefront,
      enThemeblocks,
    ],
    loadJa: async () =>
      (
        await Promise.all([
          import('../../messages/ja/auth.json'),
          import('../../messages/ja/common.json'),
          import('../../messages/ja/consent.json'),
          import('../../messages/ja/errors.json'),
          import('../../messages/ja/legal.json'),
          import('../../messages/ja/privacy.json'),
          import('../../messages/ja/settings.json'),
          import('../../messages/ja/storefront.json'),
          import('../../messages/ja/themeblocks.json'),
        ])
      ).map(toShard),
  })
}
