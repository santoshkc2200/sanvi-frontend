/**
 * Connection-health presentation for advertising connections (phase 10,
 * TASK-011).
 *
 * Everything here renders **server-computed** fields (`GET /connections`'s
 * `ConnectionHealthView`) and derives nothing from raw state that the
 * backend already decided. `adHealthState`'s only job is folding those
 * fields into the one state a tenant must act on right now — the screen
 * shows a single message and a single fixing action, never a pile of
 * simultaneous warnings.
 *
 * `@sanvi/ui` imports no data layer, so these are structural mirrors of the
 * contract's `ConnectionHealthView` (same rule as `forms/types.ts`'s
 * `AdCapabilityMatrix`): field names match the wire so the caller passes
 * the response through untouched.
 */

/** Structural mirror of the contract's `ConnectionHealthView`. */
export interface AdConnectionHealthData {
  can_sync: boolean
  can_upload_conversions: boolean
  scopes_missing: string[]
  reconnect_required: boolean
  token_expires_at?: string | null
  last_error?: string | null
  last_synced_at?: string | null
}

/**
 * The one health state a connection is in, most urgent first:
 *
 * - `disconnected` — the tenant disconnected it; connecting again is a
 *   deliberate fresh start.
 * - `reconnect_required` — permanent token failure (revoked, password
 *   changed, app removed). Only reconnecting fixes it.
 * - `reconsent_required` — the platform granted fewer scopes than the
 *   adapter now requires. Reconnecting re-consents; the screen names the
 *   missing scopes and what stopped working.
 * - `sync_failing` — sync or conversion upload is failing with an error.
 *   With a valid token and complete scopes this is the token's problem too,
 *   so the fixing action is still reconnect.
 * - `expiring` — the token lapses within `EXPIRING_SOON_SECS`; reconnecting
 *   now avoids a gap.
 * - `healthy` — nothing to fix; last sync time is the reassurance.
 */
export type AdHealthState =
  | 'disconnected'
  | 'reconnect_required'
  | 'reconsent_required'
  | 'sync_failing'
  | 'expiring'
  | 'healthy'

/**
 * "Soon" for token expiry: a week. Long enough that a proactive reconnect
 * is one prompt, short enough that the warning is never stale for months.
 */
export const EXPIRING_SOON_SECS = 7 * 24 * 60 * 60

/**
 * Folds a connection's status + server-computed health into the single
 * state to render. `nowMs` is injectable so tests and callers pin the
 * clock; `status` is the wire's connection status (`active`, `pending`,
 * `disconnected`, `expired`).
 */
export function adHealthState(
  status: string,
  health: AdConnectionHealthData,
  nowMs: number = Date.now(),
): AdHealthState {
  if (status === 'disconnected') return 'disconnected'
  if (health.reconnect_required || status === 'expired') return 'reconnect_required'
  if (health.scopes_missing.length > 0) return 'reconsent_required'
  if (!health.can_sync || !health.can_upload_conversions) return 'sync_failing'
  if (health.token_expires_at) {
    const expiresAt = Date.parse(health.token_expires_at)
    if (Number.isFinite(expiresAt)) {
      if (expiresAt <= nowMs) {
        return 'reconnect_required'
      }
      if (expiresAt - nowMs <= EXPIRING_SOON_SECS * 1000) {
        return 'expiring'
      }
    }
  }
  return 'healthy'
}

/**
 * The badge variants per health state — every state also carries its own
 * text label from the caller, so variant (colour) is never the only
 * encoding.
 */
export const AD_HEALTH_TONES: Record<AdHealthState, 'success' | 'warning' | 'error' | 'neutral'> = {
  disconnected: 'neutral',
  reconnect_required: 'error',
  reconsent_required: 'warning',
  sync_failing: 'error',
  expiring: 'warning',
  healthy: 'success',
}
