import { loadConnectAndInitialize, type StripeConnectInstance } from '@stripe/connect-js'
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
  /** Theme mode for appearance tokens ('light' or 'dark'). Defaults to detecting from data-theme or 'light'. */
  theme?: 'light' | 'dark'
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
 * `scripts/assert-connect-js-bundle.mjs` and the bundle test).
 */
export async function initializePaymentsConnect(
  options: PaymentsConnectInitOptions,
): Promise<PaymentsConnectInstance> {
  const { publishableKey, fetchClientSecret, locale, theme: explicitTheme } = options

  if (!publishableKey) {
    throw new Error('VITE_STRIPE_PUBLISHABLE_KEY is not configured')
  }
  if (!publishableKey.startsWith('pk_')) {
    throw new Error('publishableKey must start with pk_')
  }

  const theme =
    explicitTheme ??
    (typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark'
      : 'light')
  const appearance = getConnectAppearance(theme)

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
