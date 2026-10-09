import type { Session } from '@sanvi/auth/server'
import type { Locale } from '@sanvi/i18n'
import type { TenantContext } from '@sanvi/tenant'
import type { ResolvedTheme } from '@sanvi/theme-runtime'
import type { BuildDetails } from '@sanvi/api-client'

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      /** Resolved from the request's `Host` header by `hooks.server.ts`'s `resolveTenant`. `null` when `tenantResolution` is `'unknown-host'` or `'backend-unavailable'`. */
      tenant: TenantContext | null
      /**
       * `'backend-unavailable'` (TASK-023) means the tenant-context request
       * *failed* — cold cache, backend down. Unlike `'unknown-host'` (a 404:
       * nobody's tenant), the root layout renders the designed outage view
       * instead of a 500, because "we're having a problem" is the honest
       * answer and the theme/privacy legs may still have cache to serve.
       */
      tenantResolution: 'ok' | 'unknown-host' | 'backend-unavailable'
      /** The tenant resolution came from the stale-while-revalidate window — the layout renders the stale-content banner (says what is stale). */
      tenantStale: boolean
      /** The negotiated render locale — phase 06's `resolveLocale` hook (URL prefix → cookie → session → tenant default → `Accept-Language` → base). */
      locale: Locale
      /** Resolved from the request's `Cookie` header by `hooks.server.ts`'s `resolveAuth`. `null` when signed out. */
      session: Session | null
      /** Resolved from the host/tenant and cached per host/locale or fallback. */
      theme: ResolvedTheme
      /**
       * Extra inline `<style>` contents a server load renders on top of the
       * layout's theme tag (e.g. `_theme-preview`'s previewed theme).
       * `runtimeConnectSrc` hashes each into `style-src` — the TASK-024
       * tightened policy has no `unsafe-inline`, so every inline style the
       * page emits must be enumerated here.
       */
      themeStyleOverrides: string[]
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
  /** Injected by `vite.config.ts`'s `define` — the FR-1103 release stamp, the same shape `GET /api/v1/system/build` returns. */
  const __APP_BUILD__: BuildDetails
}
