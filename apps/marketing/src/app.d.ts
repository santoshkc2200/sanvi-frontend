// See https://svelte.dev/docs/kit/types#app.d.ts
import type { BuildDetails } from '@sanvi/api-client'

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  /** Injected by `vite.config.ts`'s `define` from `package.json`'s version. */
  const __APP_VERSION__: string
  /** Injected by `vite.config.ts`'s `define` — the FR-1103 release stamp, the same shape `GET /api/v1/system/build` returns. */
  const __APP_BUILD__: BuildDetails
}
