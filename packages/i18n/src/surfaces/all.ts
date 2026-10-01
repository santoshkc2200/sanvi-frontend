import { registerCatalogSurface, toShard } from '../catalogs'
import enAdmin from '../../messages/en/admin.json'
import enAuth from '../../messages/en/auth.json'
import enCommon from '../../messages/en/common.json'
import enConsent from '../../messages/en/consent.json'
import enErrors from '../../messages/en/errors.json'
import enLegal from '../../messages/en/legal.json'
import enMarketing from '../../messages/en/marketing.json'
import enPayments from '../../messages/en/payments.json'
import enPlatform from '../../messages/en/platform.json'
import enPrivacy from '../../messages/en/privacy.json'
import enSettings from '../../messages/en/settings.json'
import enStorefront from '../../messages/en/storefront.json'
import enThemeblocks from '../../messages/en/themeblocks.json'

/**
 * Every shard at once — **tests only, never import from an app.** The i18n
 * package's own tests and any tooling that needs the complete catalog
 * register this surface; an app importing it would undo TASK-032's bundle
 * split, and the `check:i18n-shards` build gate exists to catch exactly that.
 */
export function registerAllSurfaces(): void {
  registerCatalogSurface('all', {
    en: [
      enAdmin,
      enAuth,
      enCommon,
      enConsent,
      enErrors,
      enLegal,
      enMarketing,
      enPayments,
      enPlatform,
      enPrivacy,
      enSettings,
      enStorefront,
      enThemeblocks,
    ],
    loadJa: async () =>
      (
        await Promise.all([
          import('../../messages/ja/admin.json'),
          import('../../messages/ja/auth.json'),
          import('../../messages/ja/common.json'),
          import('../../messages/ja/consent.json'),
          import('../../messages/ja/errors.json'),
          import('../../messages/ja/legal.json'),
          import('../../messages/ja/marketing.json'),
          import('../../messages/ja/payments.json'),
          import('../../messages/ja/platform.json'),
          import('../../messages/ja/privacy.json'),
          import('../../messages/ja/settings.json'),
          import('../../messages/ja/storefront.json'),
          import('../../messages/ja/themeblocks.json'),
        ])
      ).map(toShard),
  })
}
