import {
  getSystemReadiness,
  systemBannerFor,
  type ApiClient,
  type ReadinessStates,
  type SystemBannerSignal,
} from '@sanvi/api-client'

/**
 * Whether the tenant's lifecycle status means "being restored" (TASK-025
 * step 5). The backend's runtime statuses today are
 * `provisioning | active | suspended | archived`; `restoring` is the
 * forward-compatible restoring state the single-tenant restore will report —
 * handled here so a tenant under restore renders the honest restore state
 * rather than an empty dataset that reads as data loss. Unknown statuses
 * deliberately do **not** map here: an unknown status is a bug to surface,
 * not a restore to assume.
 */
export function isTenantRestoring(status: string): boolean {
  return status === 'restoring'
}

let readiness = $state<ReadinessStates | null>(null)
let loadError = $state<unknown>(undefined)
let hasPolled = $state(false)
let timer: ReturnType<typeof setInterval> | undefined

/**
 * The banner the operator's signal currently calls for (TASK-025 step 4):
 * `null` before the first poll and whenever the platform is healthy, the
 * `systemBannerFor` mapping otherwise. The host re-reads this on every
 * render — setting the signal shows the banner, clearing it removes it,
 * with no second manual action anywhere.
 */
export function getSystemBannerSignal(): SystemBannerSignal | null {
  if (!hasPolled) return null
  return systemBannerFor(readiness, loadError)
}

/** One poll of `GET /api/v1/system/ready`; failures are signal, not exceptions. */
export async function pollSystemStatus(client: ApiClient): Promise<void> {
  try {
    readiness = await getSystemReadiness(client)
    loadError = undefined
  } catch (error) {
    loadError = error
  } finally {
    hasPolled = true
  }
}

/** Starts the revive-on-interval poll; safe to call twice (restarts the timer). */
export function startSystemStatusPolling(client: ApiClient, intervalMs = 30_000): void {
  stopSystemStatusPolling()
  void pollSystemStatus(client)
  timer = setInterval(() => void pollSystemStatus(client), intervalMs)
}

export function stopSystemStatusPolling(): void {
  if (timer !== undefined) clearInterval(timer)
  timer = undefined
}
