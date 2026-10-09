export interface AppEnv {
  apiOrigin: string
  /**
   * Per-request timeout for the API client, in milliseconds (TASK-023). The
   * 10 s default is the product decision; the outage e2e overrides it via
   * build env so its hang mode terminates in seconds.
   */
  apiTimeoutMs: number | undefined
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

  const apiTimeoutRaw = import.meta.env['VITE_API_TIMEOUT_MS'] as string | undefined
  const apiTimeoutParsed = apiTimeoutRaw ? Number(apiTimeoutRaw) : Number.NaN
  // Mirrors the storefront's normalizeMs: `0` would abort every request
  // instantly, so only a positive finite number is an override.
  const apiTimeoutMs =
    Number.isFinite(apiTimeoutParsed) && apiTimeoutParsed > 0 ? apiTimeoutParsed : undefined

  return {
    apiOrigin,
    apiTimeoutMs,
    mediaOrigin: import.meta.env.VITE_MEDIA_ORIGIN || undefined,
    kratosOrigin,
    storefrontOrigin: import.meta.env.VITE_STOREFRONT_ORIGIN || 'http://localhost:4174',
    stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || undefined,
  }
}
