/**
 * RFC 9457 (`application/problem+json`) — the only error shape the backend
 * sends (`docs/architecture-overview.md` §5). Every non-2xx response gets
 * mapped to an {@link ApiError} here so callers never touch raw response
 * bodies or render server error text directly.
 */
export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail?: string
  instance?: string
  /** Correlates with OpenObserve; distinct from the `x-request-id` response header. */
  trace_id?: string
  /** Machine-readable differentiator for statuses that carry one — e.g. `423` tenant-lock reasons `"suspended" | "provisioning" | "archived"`. */
  reason?: string
  [extension: string]: unknown
}

/**
 * The backend's shedding contract (TASK-023, sanvi-backend TASK-023): a `503`
 * whose problem type names the platform as overloaded — "we are too busy",
 * which is a different situation from a `429` ("*you* asked too often") and
 * gets different backoff and different copy.
 */
export const PLATFORM_OVERLOADED_PROBLEM_TYPE = 'https://sanvi.app/problems/platform/overloaded'

/**
 * The degraded-mode response header (TASK-023, sanvi-backend TASK-023): on a
 * 2xx, the backend is answering from a fallback (stale cache, shed
 * computation) and the value names the scopes that are degraded — the signal
 * a surface needs to *say so* instead of rendering the payload as if it were
 * normal. Read per response via {@link RequestOptions.onResponseMeta}.
 */
export const DEGRADED_RESPONSE_HEADER = 'x-sanvi-degraded'

/**
 * `Retry-After` → milliseconds: delay-seconds per RFC 9457/7231, or an
 * HTTP-date relative to `now`. `undefined` for anything absent or unparseable
 * — a malformed header must never become an infinite wait.
 */
export function parseRetryAfterMs(
  value: string | null | undefined,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return Math.max(0, Number(trimmed) * 1000)
  const at = Date.parse(trimmed)
  if (Number.isNaN(at)) return undefined
  return Math.max(0, at - now)
}

/** The scopes named by one `x-sanvi-degraded` header value (space- or comma-separated, deduplicated). */
export function parseDegradedScopes(value: string | null | undefined): string[] {
  if (!value) return []
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  ]
}

/**
 * Why a request failed, at the granularity user-facing copy needs. `429` and
 * `503` are deliberately distinct kinds ("asked too often" vs "we are too
 * busy") — FR-1112 requires they render different messages — and network vs
 * timeout is the offline-vs-slow split the honest-copy rule turns on.
 */
export type FailureKind =
  | 'rate_limited'
  | 'overloaded'
  | 'server_error'
  | 'timeout'
  | 'network'
  | 'client'

export function failureKindOf(error: unknown): FailureKind {
  if (error instanceof TimeoutError) return 'timeout'
  if (error instanceof NetworkError) return 'network'
  if (error instanceof ApiError) {
    if (error.status === 429) return 'rate_limited'
    if (error.status === 503) return 'overloaded'
    if (error.status >= 500) return 'server_error'
    return 'client'
  }
  return 'client'
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string' &&
    typeof (value as { title?: unknown }).title === 'string' &&
    typeof (value as { status?: unknown }).status === 'number'
  )
}

export class ApiError extends Error {
  readonly status: number
  readonly type: string
  readonly title: string
  readonly detail: string | undefined
  readonly instance: string | undefined
  readonly requestId: string | undefined
  /** `problem.trace_id` — what support wants quoted; distinct from `requestId` (the header). */
  readonly traceId: string | undefined
  /** `problem.reason` — e.g. a `423`'s `"suspended" | "provisioning" | "archived"`. */
  readonly reason: string | undefined
  /** The full problem+json body, for extension members the typed fields don't cover. */
  readonly problem: ProblemDetails | undefined
  /**
   * The `Retry-After` header of the failure, in milliseconds — set when the
   * response carried one (a `503` under load, a `429` over quota). The retry
   * loop waits at least this long; a surface offering a manual retry can show
   * the same wait honestly rather than re-sending into a shed load.
   */
  readonly retryAfterMs: number | undefined

  constructor(
    status: number,
    problem: ProblemDetails | undefined,
    requestId: string | undefined,
    retryAfterMs?: number,
  ) {
    const title = problem?.title ?? `Request failed with status ${status}`
    super(title)
    this.name = 'ApiError'
    this.status = status
    this.type = problem?.type ?? 'about:blank'
    this.title = title
    this.detail = problem?.detail
    this.instance = problem?.instance
    this.requestId = requestId
    this.traceId = problem?.trace_id
    this.reason = problem?.reason
    this.problem = problem
    this.retryAfterMs = retryAfterMs
  }

  /** True for the class of errors a retry can plausibly fix. */
  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500
  }
}

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('The request could not be completed — check your connection and try again.')
    this.name = 'NetworkError'
    this.cause = cause
  }
}

export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms.`)
    this.name = 'TimeoutError'
  }
}

/**
 * Builds an {@link ApiError} from a non-2xx `Response`. Falls back to a
 * synthesized problem when the body isn't valid problem+json — a 502 from a
 * proxy in front of the API is still a real failure the caller needs typed,
 * not a JSON parse error masking it.
 */
export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  const requestId = response.headers.get('x-request-id') ?? undefined
  const contentType = response.headers.get('content-type') ?? ''
  const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'))

  if (
    contentType.includes('application/problem+json') ||
    contentType.includes('application/json')
  ) {
    try {
      const body: unknown = await response.json()
      if (isProblemDetails(body))
        return new ApiError(response.status, body, requestId, retryAfterMs)
    } catch {
      // Fall through to the synthesized problem below.
    }
  }

  return new ApiError(
    response.status,
    {
      type: 'about:blank',
      title: response.statusText || 'Request failed',
      status: response.status,
    },
    requestId,
    retryAfterMs,
  )
}
