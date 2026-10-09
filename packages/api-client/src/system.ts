import type { components } from './generated/types'
import type { ApiClient } from './client'
import { ApiError, type ProblemDetails } from './problem'
import type { TypedApiClient } from './typed'

/** Release stamp of the running backend (`GET /api/v1/system/build`). */
export type BuildDetails = components['schemas']['BuildDetails']

/**
 * `GET /api/v1/system/build` — the build probe (FR-1102). Unauthenticated
 * and `Cache-Control: public, max-age=60`, so any client can name the exact
 * deployment a measurement belongs to; the response carries the four stamp
 * fields and nothing else — no tenant data by contract. This is the release
 * tag TASK-019's collector and TASK-020's error tracker stamp every payload
 * with.
 */
export function getSystemBuild(
  client: TypedApiClient,
  signal?: AbortSignal,
): Promise<BuildDetails> {
  return client.GET('/api/v1/system/build', signal ? { signal } : undefined)
}

/**
 * Probe shapes — TASK-025 hand-wrote these while the frozen spec predated
 * the probes (see the old comment below, kept for the record). Backend
 * TASK-025/026 landed `LivenessResult`, `HealthState`, `DependencyState`
 * and `ReadinessStates` in the spec, so the generated types are now the
 * truth and the locals are deleted (TASK-026 step 1). Note the one widening
 * this adopts deliberately: `LivenessResult.status` was locally `'ok'`, the
 * spec says `string` — callers must compare, not assume.
 */
export type HealthState = components['schemas']['HealthState']
export type LivenessResult = components['schemas']['LivenessResult']
export type DependencyState = components['schemas']['DependencyState']

/**
 * Readiness as states only: the `GET /api/v1/system/ready` response body, on
 * both the 200 and the 503 path. Deliberately *not* a projection of the
 * operator-facing readiness shape: that type carries a free-form detail per
 * dependency, and any field it has is a field this public answer must never
 * grow — hence the exact-shape type test in `__tests__/system-readiness.test.ts`
 * rather than discipline. No hostname, no version, no error string, by
 * construction.
 *
 * HISTORIC (TASK-026 step 1): TASK-025 hand-wrote these four shapes while
 * the frozen spec predated the probes. The backend landed them, the
 * regeneration picked them up, and the locals were deleted in favour of the
 * generated aliases below. `isReadinessStates` stays hand-written: the 503
 * path carries states, not problem+json, so the runtime guard is
 * load-bearing regardless of what the spec says. Note the one widening this
 * adopts: `LivenessResult.status` was locally `'ok'`, the spec says
 * `string` — callers must compare, not assume.
 */
export type ReadinessStates = components['schemas']['ReadinessStates']

function isReadinessStates(value: unknown): value is ReadinessStates {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { status?: unknown; checks?: unknown }
  if (candidate.status !== 'ok' && candidate.status !== 'degraded') return false
  if (!Array.isArray(candidate.checks)) return false
  return candidate.checks.every(
    (check): check is DependencyState =>
      typeof check === 'object' &&
      check !== null &&
      typeof (check as { name?: unknown }).name === 'string' &&
      ((check as { state?: unknown }).state === 'ok' ||
        (check as { state?: unknown }).state === 'degraded'),
  )
}

/**
 * The banner a probe result calls for (TASK-025 step 4). `kind` decides
 * presentation in `@sanvi/ui`'s `StatusBanner`: `maintenance` is
 * informational and dismissible, `degraded` is blocking and persistent.
 * `checks` names the degraded dependencies so the banner can say what is
 * affected — the honest-copy rule, straight from the operator's signal.
 */
export interface SystemBannerSignal {
  kind: 'maintenance' | 'degraded'
  checks: string[]
}

/**
 * Maps the operator's readiness signal to a banner — the *same* signal
 * operators act on, never a second manual toggle. Setting the signal shows
 * the banner; clearing it removes it (the host re-runs this pure function on
 * every poll):
 *
 * - unreachable probe (a load error, no states) → `degraded`, no names —
 *   the user's action would fail, so the banner persists;
 * - several degraded dependencies → `degraded`, naming them;
 * - exactly one degraded dependency → `maintenance`, naming it — core
 *   actions still work, so the banner is informational and dismissible;
 * - everything `ok` → no banner.
 *
 * The one-vs-many split is a presentation heuristic over the states-only
 * signal (the backend names only `ok`/`degraded`); it changes copy and
 * dismissibility, never what is probed.
 */
export function systemBannerFor(
  readiness: ReadinessStates | null,
  loadError: unknown,
): SystemBannerSignal | null {
  if (readiness === null || loadError !== undefined) return { kind: 'degraded', checks: [] }
  if (readiness.status === 'ok') return null
  const degraded = readiness.checks
    .filter((check) => check.state === 'degraded')
    .map((check) => check.name)
  if (degraded.length <= 1) return { kind: 'maintenance', checks: degraded }
  return { kind: 'degraded', checks: degraded }
}

/**
 * `GET /api/v1/system/health` — liveness only, never touches the database.
 * Unauthenticated. `retries: 0`: a probe answer must be fast, not retried
 * into a slow one.
 */
export function getSystemHealth(client: ApiClient, signal?: AbortSignal): Promise<LivenessResult> {
  return client.request<LivenessResult>('/api/v1/system/health', {
    method: 'GET',
    retries: 0,
    ...(signal ? { signal } : {}),
  })
}

/**
 * `GET /api/v1/system/ready` — dependency readiness as states, never
 * hostnames, versions, or error strings. Unauthenticated. Answers 200 when
 * every dependency is healthy and 503 with the *same* states-only body when
 * one is degraded, so a 503 is a successful read of a degraded platform —
 * returned, not thrown. `retries: 0` for the same reason as
 * {@link getSystemHealth}: the degraded answer is the signal, and retrying
 * it only delays the banner.
 *
 * Implemented over `requestRaw`: the 503 body is states, not problem+json,
 * so the throwing `request` path would synthesize an `about:blank` error
 * and discard the states. Anything that is not a states body rethrows as an
 * {@link ApiError}, preserving a problem+json body when the backend sent one.
 */
export async function getSystemReadiness(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<ReadinessStates> {
  const response = await client.requestRaw<unknown>('/api/v1/system/ready', {
    method: 'GET',
    retries: 0,
    ...(signal ? { signal } : {}),
  })
  if (isReadinessStates(response.body)) {
    const { status, checks } = response.body
    return {
      status,
      checks: checks.map((check) => ({ name: check.name, state: check.state })),
    }
  }
  const problem =
    typeof response.body === 'object' && response.body !== null
      ? (response.body as ProblemDetails)
      : undefined
  throw new ApiError(
    response.status,
    problem &&
      typeof problem.type === 'string' &&
      typeof problem.title === 'string' &&
      typeof problem.status === 'number'
      ? problem
      : { type: 'about:blank', title: 'Readiness probe failed', status: response.status },
    undefined,
  )
}
