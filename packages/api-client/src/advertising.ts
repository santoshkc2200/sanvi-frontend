import type { components } from './generated/types'
import type { TypedApiClient } from './typed'

/**
 * The advertising (phase 10) contract endpoints. Slices extend this file —
 * one function per endpoint, documented with its gating — so campaign and
 * connection screens never call `fetch` themselves (repo non-negotiable #3).
 *
 * Gating summary: every `/api/v1/tenant/ads` route requires the
 * `advertising.read` permission and is served only while the
 * `advertising.enabled` flag is on (route absent → 404). The platform
 * catalog additionally requires at least one platform entitlement
 * (`advertising.google_ads`, `advertising.meta_ads`) — otherwise 403, which
 * the admin shell (TASK-009) renders as an `UpgradePrompt`.
 *
 * Connection routes (TASK-011) tighten this further: `oauth/start`,
 * `create_connection`, and `delete_connection` all require *fresh* aal2 —
 * ad account access is money access, so the backend answers 403 when the
 * session has not re-authenticated within the freshness window, and the
 * connection screen routes to step-up instead of surfacing that as an error.
 *
 * The OAuth handoff's security shape lives here in one place, where review
 * can see it: the frontend never holds a token, never holds a client
 * secret, and never constructs an authorization URL. It POSTs the backend
 * its own redirect URI, sends the browser to the `authorization_url` the
 * backend returned, and comes back to a route that redeems `state` + `code`
 * server-side. The only URL this side of the contract builds is the
 * redirect URI of the SPA's own callback route.
 */

export type PlatformsView = components['schemas']['PlatformsView']
export type PlatformView = components['schemas']['PlatformView']
export type StartOAuthResponse = components['schemas']['StartOAuthResponse']
export type PendingConnectionView = components['schemas']['PendingConnectionView']
export type AdAccountView = components['schemas']['AccountView']
export type ConnectionView = components['schemas']['ConnectionView']
export type ConnectionsView = components['schemas']['ConnectionsView']
export type ConnectionHealthView = components['schemas']['ConnectionHealthView']

/**
 * `GET /api/v1/tenant/ads/platforms` — the registry-derived advertising
 * platform catalog. Each entry carries its own entitlement state
 * (`upgrade_required` / `available`) so clients can render an upgrade path
 * per platform instead of a dead end. Returns an empty `platforms` array
 * until the backend registers capability matrices — which is exactly what
 * proves the generation pipeline end to end (TASK-009).
 */
export function listAdPlatforms(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/platforms', signal ? { signal } : undefined)
}

/**
 * `POST /api/v1/tenant/ads/connections/{platform}/oauth/start` — begins the
 * OAuth handoff. The caller passes the SPA's own callback route as
 * `redirect_uri` (the backend refuses a missing one and the platform
 * rejects a mismatched one at exchange time); the response's
 * `authorization_url` is backend-built and opaque to this client — send the
 * browser there verbatim, never parse, store, or rebuild it. Requires
 * `advertising.connect`, the platform entitlement, and fresh aal2.
 */
export function startAdOAuth(
  client: TypedApiClient,
  platform: string,
  redirectUri: string,
  signal?: AbortSignal,
) {
  return client.POST(
    '/api/v1/tenant/ads/connections/{platform}/oauth/start',
    { redirect_uri: redirectUri },
    signal ? { params: { path: { platform } }, signal } : { params: { path: { platform } } },
  )
}

/**
 * `GET /api/v1/tenant/ads/connections/{platform}/oauth/callback` — redeems
 * the platform's authorization response server-side: the backend exchanges
 * `code` at the platform, stores the tokens in the vault, and returns the
 * pending connection with the ad accounts the credentials can see. The
 * `redirect_uri` must be byte-identical to the one sent to `start`. A
 * forged, expired, replayed, or cross-tenant `state` is a 400.
 */
export function redeemAdOAuthCallback(
  client: TypedApiClient,
  platform: string,
  params: { state: string; code: string; redirectUri: string },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/tenant/ads/connections/{platform}/oauth/callback', {
    params: {
      path: { platform },
      query: { state: params.state, code: params.code, redirect_uri: params.redirectUri },
    },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `GET /api/v1/tenant/ads/connections` — every connection with
 * **server-computed** health (`can_sync`, `can_upload_conversions`,
 * `token_expires_at`, `scopes_missing`, `reconnect_required`, `last_error`,
 * `last_synced_at`). Screens render these fields as they arrive and never
 * re-derive status from raw state — if a screen finds itself computing
 * `can_sync` itself, the fix is a backend field, not frontend logic.
 */
export function listAdConnections(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/connections', signal ? { signal } : undefined)
}

/**
 * `POST /api/v1/tenant/ads/connections` — finalizes a pending connection by
 * choosing one of the accounts the callback returned. The ad account's
 * currency (ISO-4217 alpha-3) and IANA timezone are declared here, at
 * selection time — they silently define what "today" means in every metric
 * the platform reports, which is why the picker asks for them explicitly
 * instead of guessing. Requires `advertising.connect` and fresh aal2.
 */
export function createAdConnection(
  client: TypedApiClient,
  body: {
    connectionId: string
    externalAccountId: string
    currency: string
    timezone: string
  },
  signal?: AbortSignal,
) {
  return client.POST(
    '/api/v1/tenant/ads/connections',
    {
      connection_id: body.connectionId,
      external_account_id: body.externalAccountId,
      currency: body.currency,
      timezone: body.timezone,
    },
    signal ? { signal } : undefined,
  )
}

/**
 * `DELETE /api/v1/tenant/ads/connections/{connection_id}` — disconnects in
 * Sanvi only: metrics stop updating and conversion uploads stop, but the
 * campaigns keep running (and spending) on the platform. Requires
 * `advertising.connect` and fresh aal2; answers 204.
 */
export function deleteAdConnection(client: TypedApiClient, connectionId: string) {
  return client.DELETE('/api/v1/tenant/ads/connections/{connection_id}', {
    params: { path: { connection_id: connectionId } },
  })
}
