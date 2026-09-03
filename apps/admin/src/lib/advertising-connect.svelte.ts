import type { AdAccountView } from '@sanvi/api-client'

/**
 * Hand-off between the OAuth return route and the account picker (phase 10,
 * TASK-011). The contract returns the reachable ad accounts **once**, on the
 * callback redemption — there is no accounts-list endpoint to refetch from —
 * so the pending connection travels in module state across the SPA
 * navigation from `/advertising/connect/:platform/callback` to
 * `/advertising/connect/:platform`.
 *
 * A full reload on the picker (or a lost tab) empties this store; the picker
 * then renders its restart state instead of pretending to know the accounts.
 * The TTL mirrors the backend's short-lived pending connection: a picker
 * resurrected from a sleeping tab must not finalize against accounts the
 * backend has already discarded.
 */

export interface PendingAdConnection {
  platform: string
  /** The backend's pending connection id — `POST /connections` needs it. */
  connectionId: string
  accounts: AdAccountView[]
  /** Redemption time, the TTL's anchor. */
  redeemedAt: number
}

const PENDING_TTL_MS = 10 * 60 * 1000

let pending = $state<PendingAdConnection | null>(null)

export function setPendingAdConnection(value: PendingAdConnection): void {
  pending = value
}

/** Reads the pending connection for `platform` without consuming it, dropping an expired one. */
export function peekPendingAdConnection(platform: string): PendingAdConnection | null {
  if (!pending) return null
  if (pending.platform !== platform) return null
  if (Date.now() - pending.redeemedAt > PENDING_TTL_MS) {
    pending = null
    return null
  }
  return pending
}

export function clearPendingAdConnection(): void {
  pending = null
}
