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
 */

export type PlatformsView = components['schemas']['PlatformsView']
export type PlatformView = components['schemas']['PlatformView']

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
