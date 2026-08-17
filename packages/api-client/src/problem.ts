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

  constructor(status: number, problem: ProblemDetails | undefined, requestId: string | undefined) {
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

  if (
    contentType.includes('application/problem+json') ||
    contentType.includes('application/json')
  ) {
    try {
      const body: unknown = await response.json()
      if (isProblemDetails(body)) return new ApiError(response.status, body, requestId)
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
  )
}
