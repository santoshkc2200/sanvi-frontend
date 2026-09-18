/// <reference types="vite/client" />

import type { BuildDetails } from '@sanvi/api-client'

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_ORIGIN: string
    readonly VITE_MEDIA_ORIGIN?: string
    readonly VITE_KRATOS_ORIGIN: string
    readonly VITE_STOREFRONT_ORIGIN?: string
    readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }

  /** Injected by `vite.config.ts`'s `define` from `package.json`'s version. */
  const __APP_VERSION__: string
  /** Injected by `vite.config.ts`'s `define` — the FR-1103 release stamp, the same shape `GET /api/v1/system/build` returns. */
  const __APP_BUILD__: BuildDetails
}
