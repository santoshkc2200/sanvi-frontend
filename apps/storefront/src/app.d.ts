import type { TenantContext } from '@sanvi/tenant'

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      /** Resolved from the request's `Host` header by `hooks.server.ts`'s `resolveTenant`. `null` when `tenantResolution` is `'unknown-host'`. */
      tenant: TenantContext | null
      tenantResolution: 'ok' | 'unknown-host'
      /** Resolved from `Accept-Language`/cookie — filled in by phase 06. */
      locale: string
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
