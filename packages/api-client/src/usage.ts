import type { components } from './generated/types'
import type { TypedApiClient } from './typed'

/**
 * Tenant usage against quota (TASK-026, backend TASK-026). The backend's
 * consistency pass added `GET /api/v1/tenant/usage` with per-context shapes
 * (`TenantUsage`, `DimensionUsage`, `QuotaDimension`) — no hand-written
 * stand-ins were ever needed here, so this module is wrappers only.
 *
 * The number rendered is the number enforcement uses: surfaces must show
 * `used`/`limit` verbatim from this response, never a client-side estimate.
 * A dimension missing from `dimensions` is unmetered (flags off) — render
 * it as absent, not as zero.
 */
export type TenantUsage = components['schemas']['TenantUsage']
export type DimensionUsage = components['schemas']['DimensionUsage']
export type QuotaDimension = components['schemas']['QuotaDimension']

/** The six metered dimensions, in display order (matches `QuotaDimension`). */
export const QUOTA_DIMENSIONS: readonly QuotaDimension[] = [
  'api_requests',
  'tracked_conversions',
  'storage_bytes',
  'custom_domains',
  'seats',
  'notification_sends',
]

/**
 * `GET /api/v1/tenant/usage` — current-period usage against limit per
 * metered dimension, plus the plan name and the period the numbers belong
 * to (`period_end` is the reset time limit-reached copy names).
 */
export function getTenantUsage(client: TypedApiClient, signal?: AbortSignal): Promise<TenantUsage> {
  return client.GET('/api/v1/tenant/usage', signal ? { signal } : undefined)
}
