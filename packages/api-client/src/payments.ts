import type { components } from './generated/types'
import type { TypedApiClient } from './typed'

/**
 * The payments `CreateConnectionRequest` collides in name with the
 * advertising `CreateConnectionRequest` in the merged OpenAPI document.
 * The generated `components['schemas']['CreateConnectionRequest']` currently
 * resolves to the advertising shape (`connection_id` / `currency` …). Until
 * the backend renames one of them, we define the payments shape locally and
 * cast at the call site — runtime JSON is what matters, and the handler
 * (`crates/contexts/payments/src/adapters/http/handlers.rs`) expects
 * `provider` / `country` / `default_currency`.
 */
export interface CreatePaymentConnectionRequest {
  provider: string
  country?: string | null
  default_currency?: string | null
}

export interface PaymentConnectionView {
  id: string
  provider: string
  status: string
  capabilities: unknown
  requirements: {
    currently_due: Array<{ code: string; summary_key: string }>
    eventually_due: Array<{ code: string; summary_key: string }>
    past_due: Array<{ code: string; summary_key: string }>
    deadline: string | null
  }
  blockers: Array<{ summary_key: string }>
  country: string | null
  default_currency: string | null
  connected_at: string | null
  last_synced_at: string | null
  can_accept_payments: boolean
}

type ConnectionSessionView = components['schemas']['ConnectionSessionView']

/**
 * `GET /api/v1/tenant/payments/providers` — connectable payment providers.
 * Gated by the `payments.enabled` flag (route absent when off),
 * `payments.read`, and the `payments.stripe_connect` entitlement (403, not
 * 404). Returns an empty envelope until the catalog lands in 09.1.
 */
export function listPaymentProviders(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/payments/providers', signal ? { signal } : undefined)
}

/**
 * `POST /api/v1/tenant/payments/connections` — connect a payment provider.
 * Creates the Accounts v2 account keyed by our connection id. Requires an
 * `Idempotency-Key` UUID header; the same key returns the same connection.
 * Gated by `payments.manage` and the `payments.stripe_connect` entitlement.
 * 409 means an active connection already exists.
 */
export function createPaymentConnection(
  client: TypedApiClient,
  body: CreatePaymentConnectionRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<PaymentConnectionView> {
  return client.POST(
    '/api/v1/tenant/payments/connections',
    body as unknown as components['schemas']['CreateConnectionRequest'],
    {
      idempotencyKey,
      ...(signal ? { signal } : {}),
    },
  ) as unknown as Promise<PaymentConnectionView>
}

/**
 * `POST /api/v1/tenant/payments/connections/{id}/session` — mint an Account
 * Session client secret for the embedded `account_onboarding` component.
 * Fetched per render, never persisted. Requires `Idempotency-Key`; the key
 * is fresh per call (the session is single-render).
 * 409 when the connection is not active, 502 when the provider is unavailable.
 */
export function createPaymentConnectionSession(
  client: TypedApiClient,
  connectionId: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ConnectionSessionView> {
  return client.POST('/api/v1/tenant/payments/connections/{id}/session', undefined, {
    params: { path: { id: connectionId } },
    idempotencyKey,
    ...(signal ? { signal } : {}),
  })
}

/**
 * `GET /api/v1/tenant/payments/connections/{id}` — fetch a connection's
 * status, capabilities, requirements, blockers and `can_accept_payments`.
 * Used for live-ish updates while onboarding is incomplete (TASK-004) and
 * for resumability checks.
 */
export function getPaymentConnection(
  client: TypedApiClient,
  connectionId: string,
  signal?: AbortSignal,
): Promise<PaymentConnectionView> {
  return client.GET('/api/v1/tenant/payments/connections/{id}', {
    params: { path: { id: connectionId } },
    ...(signal ? { signal } : {}),
  }) as unknown as Promise<PaymentConnectionView>
}

export type CreateCheckoutRequest = components['schemas']['CreateCheckoutRequest']
export type CheckoutView = components['schemas']['CheckoutView']

/**
 * `POST /api/v1/tenant/checkout` — start a purchase on the tenant's own
 * connected account (09.4, direct charges). Requires an `Idempotency-Key`
 * header to ensure one double-clicked buy button creates one session.
 */
export function createTenantCheckout(
  client: TypedApiClient,
  body: CreateCheckoutRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<CheckoutView> {
  return client.POST('/api/v1/tenant/checkout', body, {
    idempotencyKey,
    ...(signal ? { signal } : {}),
  })
}

/**
 * `GET /api/v1/tenant/checkout/{id}` — the confirming state. Polled by the
 * confirmation page with backoff. Webhook is the truth; order state is never
 * derived from the return URL.
 */
export function getTenantCheckout(
  client: TypedApiClient,
  checkoutId: string,
  signal?: AbortSignal,
): Promise<CheckoutView> {
  return client.GET('/api/v1/tenant/checkout/{id}', {
    params: { path: { id: checkoutId } },
    ...(signal ? { signal } : {}),
  })
}
