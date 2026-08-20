import type { TypedApiClient } from './typed'

/**
 * `GET /api/v1/tenant/payments/providers` — connectable payment providers.
 * Gated by the `payments.enabled` flag (route absent when off),
 * `payments.read`, and the `payments.stripe_connect` entitlement (403, not
 * 404). Returns an empty envelope until the catalog lands in 09.1.
 */
export function listPaymentProviders(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/payments/providers', signal ? { signal } : undefined)
}
