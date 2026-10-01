import { registerCatalogSurface, toShard } from '../catalogs'
import enAdmin from '../../messages/en/admin.json'
import enCommon from '../../messages/en/common.json'
import enConsent from '../../messages/en/consent.json'
import enErrors from '../../messages/en/errors.json'
import enPayments from '../../messages/en/payments.json'

/**
 * The tenant admin console's catalog surface (TASK-032): the (large) `admin`
 * shard, the payments-settings strings the phase-09 screens read — including
 * API-driven warning keys resolved through `hasMessage` — plus shared chrome
 * and error strings. Deliberately **not** included: `platform`, `privacy`,
 * `storefront`, `marketing`, `themeblocks`.
 *
 * Registered by `apps/admin`'s `main.ts` before `initI18n`, so even the
 * boot-failure screen renders localized copy.
 */
export function registerAdminSurface(): void {
  registerCatalogSurface('admin', {
    en: [enAdmin, enCommon, enConsent, enErrors, enPayments],
    loadJa: async () =>
      (
        await Promise.all([
          import('../../messages/ja/admin.json'),
          import('../../messages/ja/common.json'),
          import('../../messages/ja/consent.json'),
          import('../../messages/ja/errors.json'),
          import('../../messages/ja/payments.json'),
        ])
      ).map(toShard),
  })
}
