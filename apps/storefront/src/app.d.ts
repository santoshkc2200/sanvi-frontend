// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      /** Resolved from the request's subdomain/custom domain — filled in by phase 01. */
      tenant: { id: string; slug: string } | null
      /** Resolved from `Accept-Language`/cookie — filled in by phase 06. */
      locale: string
    }
    // interface Error {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  /** Injected by `vite.config.ts`'s `define` from `package.json`'s version. */
  const __APP_VERSION__: string
}

export {}
