import { registerCatalogSurface, toShard } from '../catalogs'
import enCommon from '../../messages/en/common.json'
import enErrors from '../../messages/en/errors.json'
import enPlatform from '../../messages/en/platform.json'

/**
 * The platform operator console's catalog surface (TASK-032): `platform`
 * plus shared chrome and error strings. The two `admin.*` keys both consoles
 * share (`boot.failureMessage`, `nav.switchLanguage`) moved to `common` in
 * this task so this surface carries no `admin` shard at all.
 *
 * Registered by `apps/platform-admin`'s `main.ts` before `initI18n`.
 */
export function registerPlatformAdminSurface(): void {
  registerCatalogSurface('platform-admin', {
    en: [enCommon, enErrors, enPlatform],
    loadJa: async () =>
      (
        await Promise.all([
          import('../../messages/ja/common.json'),
          import('../../messages/ja/errors.json'),
          import('../../messages/ja/platform.json'),
        ])
      ).map(toShard),
  })
}
