import type { ReadinessStates } from '@sanvi/api-client'

/**
 * The six SLO journeys (`sanvi-backend/docs/slo/budgets.md`, "The six
 * journeys"). Pinned here — the backend file lives outside this repository,
 * so this list is the frontend's copy of it, and the template-coverage test
 * in `__tests__/status.test.ts` reads *this* list: adding a seventh journey
 * backend-side without adding its templates here fails that test's intent,
 * and the mismatch is caught at the TASK-025 contract review (the client
 * regeneration in TASK-026 re-checks the backend docs).
 */
export const SLO_JOURNEYS = [
  'storefront-read',
  'admin-write',
  'checkout-create',
  'webhook-processing',
  'conversion-upload',
  'domain-issuance',
] as const

export type SloJourney = (typeof SLO_JOURNEYS)[number]

/** One entry of the public incident history, rendered from live templates. */
export interface StatusIncident {
  id: string
  /** ISO date the incident resolved (or started, when ongoing). */
  date: string
  journey: SloJourney
  resolved: boolean
}

/**
 * The public incident history. Empty today — and honestly so: the empty
 * state says "no incidents recorded" rather than rendering a zero. An
 * operator publishes from the per-journey templates (the
 * `marketing.status.incident.*` catalog keys) instead of composing under
 * pressure; entries land here when that happens.
 */
export const INCIDENT_HISTORY: StatusIncident[] = []

/** What the status page shows: live state, or its last known state. */
export type OverallStatus = 'operational' | 'degraded' | 'unknown'

/**
 * Maps the probe result to the page state — a pure function of the
 * operator's signal, no second toggle. No states (unreachable now and no
 * last-known render) is `unknown`: the page says so and shows its last
 * known state rather than an error.
 */
export function toOverallStatus(
  readiness: ReadinessStates | null,
  loadError: unknown,
): OverallStatus {
  if (readiness === null || loadError !== undefined) return 'unknown'
  return readiness.status === 'ok' ? 'operational' : 'degraded'
}
