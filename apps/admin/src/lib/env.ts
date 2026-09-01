export interface AppEnv {
  apiOrigin: string
  mediaOrigin: string | undefined
  /** Ory Kratos's public API origin — `@sanvi/auth` calls it directly from the browser. */
  kratosOrigin: string
  storefrontOrigin: string
  /**
   * Stripe publishable key for Connect embedded components (pk_…).
   * Build-time public env, never a secret key; empty in dev when the fake
   * provider is used, required in production when the real Stripe account
   * exists. Mirrors the VITE_ pattern every other public runtime value in
   * this SPA uses.
   */
  stripePublishableKey: string | undefined
}

/**
 * Vite inlines `import.meta.env.VITE_*` at build time — unlike the
 * SvelteKit apps' `$env/dynamic/private`, there is no per-request read, so
 * a misconfigured deploy fails at build/boot, not on first request.
 */
export function getAppEnv(): AppEnv {
  const apiOrigin = import.meta.env.VITE_API_ORIGIN
  if (!apiOrigin) {
    throw new Error('VITE_API_ORIGIN is required but was not set.')
  }
  const kratosOrigin = import.meta.env.VITE_KRATOS_ORIGIN
  if (!kratosOrigin) {
    throw new Error('VITE_KRATOS_ORIGIN is required but was not set.')
  }

  return {
    apiOrigin,
    mediaOrigin: import.meta.env.VITE_MEDIA_ORIGIN || undefined,
    kratosOrigin,
    storefrontOrigin: import.meta.env.VITE_STOREFRONT_ORIGIN || 'http://localhost:4174',
    stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || undefined,
  }
}
