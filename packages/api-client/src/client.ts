import { ApiError, apiErrorFromResponse, NetworkError, TimeoutError } from './problem'

export interface ApiClientConfig {
  /** e.g. `https://api.sanvi.app` — no trailing slash. */
  baseUrl: string
  /** Returns the current session token, or `undefined` when signed out. Called per request — never cache the token in the client. */
  getAuthToken?: () => string | undefined | Promise<string | undefined>
  /** Returns the active tenant id for the multi-tenant header (wired to real resolution in phase 01). */
  getTenantId?: () => string | undefined
  /** @default 10_000 */
  timeoutMs?: number
  /** Retries on network errors and retryable status codes (429, 5xx). @default 2 */
  retries?: number
  /** @default 250 — doubles each attempt, capped at 4s, plus jitter. */
  retryBaseDelayMs?: number
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** JSON-serialized as the request body; do not pass a pre-stringified body. */
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Overrides the client-level default for this call. */
  timeoutMs?: number
  /** Overrides the client-level default for this call. */
  retries?: number
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>
  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>
  post<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T>
  put<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T>
  patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T>
  delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>
}

function buildUrl(baseUrl: string, path: string, query: RequestOptions['query']): string {
  const url = new URL(path, `${baseUrl}/`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return url.toString()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelay(attempt: number, baseDelayMs: number): number {
  const exponential = Math.min(baseDelayMs * 2 ** attempt, 4_000)
  return exponential + Math.random() * baseDelayMs
}

/**
 * The one place `fetch` is called in the whole workspace (`no-restricted-globals`
 * lint gate enforces this everywhere else) — auth header, tenant header,
 * request id, timeout, retry, and problem+json → {@link ApiError} mapping
 * all live here so every app gets them for free.
 *
 * The generated OpenAPI client (phase 01) wraps `request` with typed
 * per-endpoint methods; this file only ships the runtime it needs.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const {
    baseUrl,
    getAuthToken,
    getTenantId,
    timeoutMs: defaultTimeoutMs = 10_000,
    retries: defaultRetries = 2,
    retryBaseDelayMs = 250,
  } = config

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      query,
      headers = {},
      signal,
      timeoutMs = defaultTimeoutMs,
      retries = defaultRetries,
    } = options

    const url = buildUrl(baseUrl, path, query)
    const requestId = crypto.randomUUID()
    const token = await getAuthToken?.()
    const tenantId = getTenantId?.()

    const requestHeaders: Record<string, string> = {
      accept: 'application/json',
      'x-request-id': requestId,
      ...headers,
    }
    if (body !== undefined) requestHeaders['content-type'] = 'application/json'
    if (token) requestHeaders['authorization'] = `Bearer ${token}`
    if (tenantId) requestHeaders['x-tenant-id'] = tenantId

    let lastError: unknown

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (attempt > 0) await sleep(retryDelay(attempt - 1, retryBaseDelayMs))

      const timeoutController = new AbortController()
      const timeout = setTimeout(() => timeoutController.abort(), timeoutMs)
      const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutController.signal])
        : timeoutController.signal

      try {
        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: combinedSignal,
          credentials: 'omit', // session lives in an httpOnly cookie the backend sets; never read/sent from JS
        })

        if (!response.ok) {
          const apiError = await apiErrorFromResponse(response)
          if (apiError.isRetryable && attempt < retries) {
            lastError = apiError
            continue
          }
          throw apiError
        }

        if (response.status === 204) return undefined as T
        return (await response.json()) as T
      } catch (error) {
        if (error instanceof ApiError) throw error

        if (signal?.aborted) throw error // caller-initiated cancellation — never retried, never wrapped

        if (timeoutController.signal.aborted) {
          lastError = new TimeoutError(timeoutMs)
        } else {
          lastError = new NetworkError(error)
        }

        if (attempt < retries) continue
        throw lastError
      } finally {
        clearTimeout(timeout)
      }
    }

    throw lastError
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  }
}
