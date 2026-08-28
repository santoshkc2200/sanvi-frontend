import type { TypedApiClient } from './typed'

/**
 * `GET /api/v1/public/plans` — the public pricing page catalog (localized,
 * hidden plans excluded).
 */
export function listPublicPlans(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/public/plans', signal ? { signal } : undefined)
}

/**
 * `POST /api/v1/tenant/billing/checkout-session` — start subscribing via Stripe
 * Checkout. Access is granted only when Stripe webhooks arrive, never from the
 * redirect.
 */
export function createCheckoutSession(
  client: TypedApiClient,
  body: { price_id: string; success_url?: string | null; cancel_url?: string | null },
  signal?: AbortSignal,
) {
  return client.POST(
    '/api/v1/tenant/billing/checkout-session',
    body,
    signal ? { signal } : undefined,
  )
}

/**
 * `POST /api/v1/tenant/billing/portal-session` — open the Stripe Customer Portal
 * (upgrades, downgrades, cancellation, payment methods).
 */
export function createPortalSession(
  client: TypedApiClient,
  body: { return_url?: string | null } = {},
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/tenant/billing/portal-session', body, signal ? { signal } : undefined)
}

/**
 * `GET /api/v1/tenant/billing/subscription` — the tenant's current subscription
 * and dunning state. Returns null when the tenant has no subscription.
 */
export function getSubscription(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/billing/subscription', signal ? { signal } : undefined)
}

/**
 * `GET /api/v1/tenant/billing/invoices` — the tenant's invoices, newest first.
 */
export function listInvoices(
  client: TypedApiClient,
  query?: { limit?: number },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/tenant/billing/invoices', {
    params: { query },
    ...(signal ? { signal } : {}),
  })
}
