import type { Session } from '@sanvi/auth/server'
import type { Locale } from '@sanvi/i18n'
import type { TenantContext } from '@sanvi/tenant'
import type { ResolvedTheme } from '@sanvi/theme-runtime'

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      /** Resolved from the request's `Host` header by `hooks.server.ts`'s `resolveTenant`. `null` when `tenantResolution` is `'unknown-host'`. */
      tenant: TenantContext | null
      tenantResolution: 'ok' | 'unknown-host'
      /** The negotiated render locale — phase 06's `resolveLocale` hook (URL prefix → cookie → session → tenant default → `Accept-Language` → base). */
      locale: Locale
      /** Resolved from the request's `Cookie` header by `hooks.server.ts`'s `resolveAuth`. `null` when signed out. */
      session: Session | null
      /** Resolved from the host/tenant and cached per host/locale or fallback. */
      theme: ResolvedTheme
    }
    interface Error {
      message: string
      /** Support-quotable id — populated for the 404/500 branches `+error.svelte` renders. */
      traceId?: string
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  /** Injected by `vite.config.ts`'s `define` from `package.json`'s version. */
  const __APP_VERSION__: string
}
