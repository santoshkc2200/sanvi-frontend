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
  /**
   * Passed straight through to `fetch`. `'omit'` was the only option before
   * phase 02: the session didn't exist yet, so there was nothing to send.
   * Now that Kratos sets an `HttpOnly` session cookie, callers that need
   * `/api/v1/me` (or Kratos's own self-service endpoints) must pass
   * `'include'` — the cookie is never readable from JS either way, so this
   * only controls whether the browser attaches it, not whether anything
   * sensitive touches this code. @default 'omit'
   */
  credentials?: 'omit' | 'include' | 'same-origin'
  /**
   * Extra headers merged in before `getAuthToken`/`getTenantId`'s (so those
   * still win on a key collision). The one real use: SSR forwarding a
   * `Cookie` header — Node's `fetch` has no browser-style cookie jar, and
   * `credentials: 'include'` is a no-op outside a browser, so a server-side
   * caller that needs the session cookie sent has to attach it explicitly
   * (`@sanvi/tenant/server`'s host-forwarding code is the same problem, one
   * header over).
   */
  getExtraHeaders?: () => Record<string, string> | undefined
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

export interface RawResponse<T> {
  status: number
  body: T | undefined
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
  /**
   * Escape hatch for callers talking to a non-`problem+json` API (Kratos):
   * never throws {@link ApiError} and never retries — it resolves with
   * whatever status/body the server sent, 2xx or not, so the caller can
   * inspect a non-problem+json error body itself (`request`'s
   * `apiErrorFromResponse` mapping would otherwise discard it, since it only
   * recognizes RFC 9457 shapes). Still the same `fetch` call site, auth/tenant
   * headers, and timeout handling as `request` — only the response handling
   * differs. Network/timeout failures still throw ({@link NetworkError},
   * {@link TimeoutError}), since there is no body to hand back in that case.
   */
  requestRaw<T>(path: string, options?: RequestOptions): Promise<RawResponse<T>>
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
    credentials = 'omit',
    getExtraHeaders,
  } = config

  /** One `fetch` attempt: builds the URL/headers, applies the timeout, and throws {@link NetworkError}/{@link TimeoutError} on a transport failure. No status handling — callers decide what a non-2xx response means. */
  async function doFetch(path: string, options: RequestOptions): Promise<Response> {
    const {
      method = 'GET',
      body,
      query,
      headers = {},
      signal,
      timeoutMs = defaultTimeoutMs,
    } = options

    const url = buildUrl(baseUrl, path, query)
    const requestId = crypto.randomUUID()
    const token = await getAuthToken?.()
    const tenantId = getTenantId?.()

    const requestHeaders: Record<string, string> = {
      accept: 'application/json',
      'x-request-id': requestId,
      ...getExtraHeaders?.(),
      ...headers,
    }
    if (body !== undefined) requestHeaders['content-type'] = 'application/json'
    if (token) requestHeaders['authorization'] = `Bearer ${token}`
    if (tenantId) requestHeaders['x-tenant-id'] = tenantId

    const timeoutController = new AbortController()
    const timeout = setTimeout(() => timeoutController.abort(), timeoutMs)
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal

    try {
      return await fetch(url, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: combinedSignal,
        credentials, // 'omit' by default; callers that need the session cookie sent pass 'include'
      })
    } catch (error) {
      if (signal?.aborted) throw error // caller-initiated cancellation — never wrapped
      if (timeoutController.signal.aborted) throw new TimeoutError(timeoutMs)
      throw new NetworkError(error)
    } finally {
      clearTimeout(timeout)
    }
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { retries = defaultRetries } = options

    let lastError: unknown

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (attempt > 0) await sleep(retryDelay(attempt - 1, retryBaseDelayMs))

      try {
        const response = await doFetch(path, options)

        if (!response.ok) {
          const apiError = await apiErrorFromResponse(response)
          if (apiError.isRetryable && attempt < retries) {
            lastError = apiError
            continue
          }
          throw apiError
        }

        // A 2xx with no JSON body (204, empty 200, non-JSON content type)
        // resolves to undefined — a bare `response.json()` would reject with
        // a raw SyntaxError that escapes the ApiError/NetworkError typing.
        if (response.status === 204) return undefined as T
        const contentType = response.headers.get('content-type') ?? ''
        if (!contentType.includes('json')) return undefined as T
        try {
          return (await response.json()) as T
        } catch {
          return undefined as T
        }
      } catch (error) {
        if (error instanceof ApiError) throw error
        if (error instanceof TimeoutError || error instanceof NetworkError) {
          lastError = error
          if (attempt < retries) continue
          throw error
        }
        throw error
      }
    }

    throw lastError
  }

  async function requestRaw<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<RawResponse<T>> {
    const response = await doFetch(path, options)
    const contentType = response.headers.get('content-type') ?? ''
    if (response.status === 204 || !contentType.includes('json')) {
      return { status: response.status, body: undefined }
    }
    try {
      return { status: response.status, body: (await response.json()) as T }
    } catch {
      return { status: response.status, body: undefined }
    }
  }

  return {
    request,
    requestRaw,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  }
}
