import type { StripeConnectInstance } from '@stripe/connect-js'
import { getConnectAppearance } from './appearance'

export interface PaymentsConnectInitOptions {
  /** Publishable key for the platform (pk_…), build-time public env. */
  publishableKey: string
  /**
   * Called on every render, including remounts after tab close. Must mint a
   * fresh Account Session client_secret from
   * POST /api/v1/tenant/payments/connections/{id}/session with a fresh
   * Idempotency-Key and return it. Never cache or persist the secret.
   */
  fetchClientSecret: () => Promise<string>
  /** Locale for the embedded component, e.g. "en" or "ja". */
  locale?: string
}

export interface PaymentsConnectInstance {
  instance: StripeConnectInstance
  /** Call when the user logs out to destroy the session. */
  logout: () => void
}

/**
 * Thin Connect.js wrapper: pinned version, appearance mapped from design
 * tokens, per-render client_secret fetch. Never stores the secret.
 *
 * Loaded only by the admin app — never imported by storefront — so the
 * 40 KB+ Connect.js bundle is absent from the shopper bundle (proved by
 * `scripts/assert-connect-not-in-storefront.mjs` and the bundle test).
 */
export async function initializePaymentsConnect(
  options: PaymentsConnectInitOptions,
): Promise<PaymentsConnectInstance> {
  const { publishableKey, fetchClientSecret, locale } = options

  if (!publishableKey) {
    throw new Error('VITE_STRIPE_PUBLISHABLE_KEY is not configured')
  }
  if (!publishableKey.startsWith('pk_')) {
    throw new Error('publishableKey must start with pk_')
  }

  const { loadConnectAndInitialize } = await import('@stripe/connect-js')
  const appearance = getConnectAppearance()

  const instance = await loadConnectAndInitialize({
    publishableKey,
    fetchClientSecret,
    appearance: {
      variables: appearance.variables,
      overlays: appearance.overlays,
    },
    ...(locale ? { locale } : {}),
  })

  return {
    instance,
    logout: () => instance.logout(),
  }
}
