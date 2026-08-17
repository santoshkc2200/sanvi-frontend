/**
 * The minimal, framework-neutral connection to the Hitox course API.
 * Supply this object from a Svelte store, SvelteKit `load` data, or any
 * other client-side auth layer.
 */
export interface CourseApiContext {
  apiBaseUrl: string
  getToken: () => Promise<string>
  getTenantId: () => string | null
}

export class CourseApiError extends Error {
  readonly body: unknown
  readonly retryAfterMs: number | undefined

  constructor(
    public readonly status: number,
    public readonly code: string,
    body: unknown = undefined,
    retryAfterMs: number | undefined = undefined,
  ) {
    super(code)
    this.name = 'CourseApiError'
    this.body = body
    this.retryAfterMs = retryAfterMs
  }
}

export interface CourseApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | undefined>
  headers?: Record<string, string>
  keepalive?: boolean
  signal?: AbortSignal
}

/** Makes an authenticated JSON request without depending on React or Next.js. */
export async function courseApiRequest<T>(
  ctx: CourseApiContext,
  path: string,
  options: CourseApiRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  headers['Authorization'] = `Bearer ${await ctx.getToken()}`
  const tenantId = ctx.getTenantId()
  if (tenantId) headers['X-Tenant-ID'] = tenantId
  Object.assign(headers, options.headers)

  const url = new URL(`${ctx.apiBaseUrl}${path}`)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    keepalive: options.keepalive,
    signal: options.signal,
  })
  if (response.status === 204) return undefined as T

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const problem = (data ?? {}) as { code?: string }
    const retryAfterSeconds = Number(response.headers.get('Retry-After'))
    throw new CourseApiError(
      response.status,
      problem.code ?? 'unknown_error',
      data,
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : undefined,
    )
  }
  return data as T
}
