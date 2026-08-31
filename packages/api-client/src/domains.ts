import type { components } from './generated/types'
import type { TypedApiClient } from './typed'

type Schemas = components['schemas']

/**
 * `GET /api/v1/tenant/domains` — list all custom domain claims for the tenant.
 *
 * Re-derives the full list of domains along with their verification challenges,
 * status, and failure details.
 */
export function listCustomDomains(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/domains', signal ? { signal } : undefined)
}

/**
 * `POST /api/v1/tenant/domains` — claim a custom domain for the tenant.
 *
 * Creates a pending domain claim and returns the verification challenge (TXT token).
 * Fails with 400 if invalid hostname, 403 if missing entitlement, or 409 if already claimed.
 */
export function claimCustomDomain(
  client: TypedApiClient,
  hostnameOrBody: string | Schemas['ClaimCustomDomainCommand'],
  role?: string | null,
  signal?: AbortSignal,
) {
  const body: Schemas['ClaimCustomDomainCommand'] =
    typeof hostnameOrBody === 'string'
      ? { hostname: hostnameOrBody, ...(role !== undefined ? { role } : {}) }
      : hostnameOrBody
  return client.POST('/api/v1/tenant/domains', body, signal ? { signal } : undefined)
}

/**
 * `DELETE /api/v1/tenant/domains/{id}` — remove a custom domain claim.
 *
 * Relinquishes the tenant's claim on the domain and marks it removed.
 */
export function removeCustomDomain(client: TypedApiClient, id: string, signal?: AbortSignal) {
  return client.DELETE('/api/v1/tenant/domains/{id}', {
    params: { path: { id } },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `GET /api/v1/tenant/domains/{id}/instructions` — get DNS records and registrar instructions.
 *
 * Returns the exact DNS records (TXT challenge and CNAME/A routing records) needed to verify
 * and route traffic for the domain claim.
 */
export function getDomainInstructions(
  client: TypedApiClient,
  id: string,
  optionsOrSignal?: { locale?: string; signal?: AbortSignal } | AbortSignal,
) {
  const options =
    optionsOrSignal instanceof AbortSignal ? { signal: optionsOrSignal } : optionsOrSignal
  const { locale, signal } = options ?? {}
  return client.GET('/api/v1/tenant/domains/{id}/instructions', {
    params: {
      path: { id },
      ...(locale ? { query: { locale } } : {}),
    },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `POST /api/v1/tenant/domains/{id}/promote` — promote a domain to primary.
 *
 * Sets this domain as the tenant's canonical primary hostname, demoting the previous primary to alias.
 */
export function promoteDomain(client: TypedApiClient, id: string, signal?: AbortSignal) {
  return client.POST('/api/v1/tenant/domains/{id}/promote', undefined, {
    params: { path: { id } },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `POST /api/v1/tenant/domains/{id}/verify` — request domain verification check.
 *
 * Queues an immediate DNS verification check for the domain, subject to the backoff schedule.
 */
export function requestDomainVerification(
  client: TypedApiClient,
  id: string,
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/tenant/domains/{id}/verify', undefined, {
    params: { path: { id } },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `GET /api/v1/tenant/domains/search` — search domain availability and pricing.
 *
 * Queries domain quotes with normalized pricing for registration and renewal.
 */
export function searchDomains(client: TypedApiClient, query: string, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/domains/search', {
    params: { query: { q: query } },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `POST /api/v1/tenant/domains/orders` — place a domain registration order.
 *
 * Submits an order to register a new domain with the registrar using the supplied registrant contact.
 */
export function placeDomainOrder(
  client: TypedApiClient,
  bodyOrHostname: Schemas['PlaceDomainOrderCommand'] | string,
  termYears?: number,
  autoRenew?: boolean,
  whoisPrivacy?: boolean,
  registrant?: Schemas['RegistrantContact'],
  signal?: AbortSignal,
) {
  const body: Schemas['PlaceDomainOrderCommand'] =
    typeof bodyOrHostname === 'string'
      ? {
          hostname: bodyOrHostname,
          term_years: termYears,
          auto_renew: autoRenew,
          whois_privacy: whoisPrivacy,
          registrant_contact: registrant!,
        }
      : bodyOrHostname
  return client.POST('/api/v1/tenant/domains/orders', body, signal ? { signal } : undefined)
}

/**
 * `GET /api/v1/tenant/domains/orders` — list domain registration orders.
 *
 * Returns all domain orders and their provisioning status.
 */
export function listDomainOrders(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/domains/orders', signal ? { signal } : undefined)
}

/**
 * `POST /api/v1/tenant/domains/orders/{id}/auto-renew` — toggle auto-renew for a domain order.
 *
 * Enables or disables automatic renewal before expiry for the purchased domain.
 */
export function setOrderAutoRenew(
  client: TypedApiClient,
  id: string,
  enabled: boolean,
  signal?: AbortSignal,
) {
  return client.POST(
    '/api/v1/tenant/domains/orders/{id}/auto-renew',
    { enabled },
    {
      params: { path: { id } },
      ...(signal ? { signal } : {}),
    },
  )
}
