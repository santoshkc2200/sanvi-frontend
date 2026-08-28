import { ApiError, apiErrorFromResponse, NetworkError, TimeoutError } from './problem'

export interface ApiClientConfig {
  /** e.g. `https://api.sanvi.app` — no trailing slash. */
  baseUrl: string
  /** Returns the current session token, or `undefined` when signed out. Called per request — never cache the token in the client. */
  getAuthToken?: () => string | undefined | Promise<string | undefined>
  /** Returns the active tenant id for the multi-tenant header (wired to real resolution in phase 01). */
  getTenantId?: () => string | undefined
  /** Returns the current locale, sent as `Accept-Language` — the slot phases 06 wires to real resolution. */
  locale?: () => string
  /** @default 10_000 */
  timeoutMs?: number
  /**
   * Retries on network errors and retryable status codes (429, 5xx), for
   * idempotent methods only — a POST that timed out may have been processed,
   * and blind retrying would double-submit it. Non-idempotent methods
   * (POST, PATCH) never retry. @default 2
   */
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
  /**
   * Called when a response comes back `401`, on every request path
   * (`request` and `requestRaw`) — the hook the SPA apps point at
   * `@sanvi/auth`'s `setSession(null)` so a session that died underneath
   * the tab (revoked elsewhere, expired) stops satisfying the route guards
   * on the next navigation instead of lingering until reload. Intentionally
   * not fired for anything else: a 403 is "signed in, not allowed", not
   * "signed out".
   */
  onUnauthorized?: () => void
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** JSON-serialized as the request body; do not pass a pre-stringified body. */
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  /**
   * Sent as the `Idempotency-Key` header. For mutations against endpoints
   * that declare an idempotency key (per their OpenAPI operation): the key
   * makes a retried/supertimed-out mutation safe — the backend answers the
   * original result instead of processing twice.
   */
  idempotencyKey?: string
  signal?: AbortSignal
  /** Overrides the client-level default for this call. */
  timeoutMs?: number
  /** Overrides the client-level default for this call. */
  retries?: number
}

/**
 * Ambient per-call values captured once when a coalescable GET is initiated —
 * the coalescing key is built from them and `doFetch` sends them verbatim, so
 * a tenant/token/locale switch mid-flight can't leak one caller's response
 * (or headers) to another.
 */
interface ResolvedContext {
  token: string | undefined
  tenantId: string | undefined
  localeHeader: string | undefined
  extraHeaders: Record<string, string> | undefined
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
 * Methods a blind retry can never double-apply. A POST/PATCH that timed
 * out mid-flight may have been processed by the backend; resending it
 * would create/patch twice. Endpoints that want safe mutation retries opt
 * in via `idempotencyKey` instead (the backend then answers the original
 * result). HEAD/OPTIONS included for completeness even though this
 * client's helpers don't emit them.
 */
const IDEMPOTENT_METHODS = new Set(['GET', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'])

/**
 * The one place `fetch` is called in the whole workspace (`no-restricted-globals`
 * lint gate enforces this everywhere else) — auth header, tenant header,
 * request id, timeout, retry, single-flight GET coalescing, and
 * problem+json → {@link ApiError} mapping
 * all live here so every app gets them for free.
 *
 * The generated OpenAPI client (phase 01) wraps `request` with typed
 * per-endpoint methods; this file only ships the runtime it needs.
 */
/**
 * Combines abort signals, falling back to a manual relay where
 * `AbortSignal.any` is unavailable (jsdom, older runtimes). The fallback keeps
 * every input signal live — dropping one would silently disable the request
 * timeout.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals)

  const controller = new AbortController()
  const handlers = new Map<AbortSignal, () => void>()
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason)
      return controller.signal
    }
    handlers.set(s, () => {
      for (const [other, handler] of handlers) other.removeEventListener('abort', handler)
      controller.abort(s.reason)
    })
  }
  for (const [s, handler] of handlers) s.addEventListener('abort', handler, { once: true })
  return controller.signal
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const {
    baseUrl,
    getAuthToken,
    getTenantId,
    locale,
    timeoutMs: defaultTimeoutMs = 10_000,
    retries: defaultRetries = 2,
    retryBaseDelayMs = 250,
    credentials = 'omit',
    getExtraHeaders,
    onUnauthorized,
  } = config

  /** One `fetch` attempt: builds the URL/headers, applies the timeout, and throws {@link NetworkError}/{@link TimeoutError} on a transport failure. No status handling — callers decide what a non-2xx response means. When {@link ResolvedContext} is passed (the coalescing path), its captured values are sent verbatim; otherwise the ambient getters are read here. */
  async function doFetch(
    path: string,
    options: RequestOptions,
    context?: ResolvedContext,
  ): Promise<Response> {
    const {
      method = 'GET',
      body,
      query,
      headers = {},
      signal,
      idempotencyKey,
      timeoutMs = defaultTimeoutMs,
    } = options

    const url = buildUrl(baseUrl, path, query)
    const requestId = crypto.randomUUID()
    const token = context ? context.token : await getAuthToken?.()
    const tenantId = context ? context.tenantId : getTenantId?.()
    const extraHeaders = context ? context.extraHeaders : getExtraHeaders?.()

    const requestHeaders: Record<string, string> = {
      accept: 'application/json',
      'x-request-id': requestId,
      ...extraHeaders,
      ...headers,
    }
    if (body !== undefined) requestHeaders['content-type'] = 'application/json'
    if (token) requestHeaders['authorization'] = `Bearer ${token}`
    if (tenantId) requestHeaders['x-tenant-id'] = tenantId
    if (idempotencyKey) requestHeaders['idempotency-key'] = idempotencyKey

    const localeHeader = context ? context.localeHeader : locale?.()
    if (localeHeader) requestHeaders['accept-language'] = localeHeader

    const timeoutController = new AbortController()
    const timeout = setTimeout(() => timeoutController.abort(), timeoutMs)
    const combinedSignal = signal
      ? anySignal([signal, timeoutController.signal])
      : timeoutController.signal

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: combinedSignal,
        credentials, // 'omit' by default; callers that need the session cookie sent pass 'include'
      })
      if (response.status === 401) onUnauthorized?.()
      return response
    } catch (error) {
      if (signal?.aborted) throw error // caller-initiated cancellation — never wrapped
      if (timeoutController.signal.aborted) throw new TimeoutError(timeoutMs)
      throw new NetworkError(error)
    } finally {
      clearTimeout(timeout)
    }
  }

  async function requestWithRetries<T>(
    path: string,
    options: RequestOptions,
    context?: ResolvedContext,
  ): Promise<T> {
    const method = options.method ?? 'GET'
    // Non-idempotent methods never retry, whatever the caller asked for.
    const retries = IDEMPOTENT_METHODS.has(method) ? (options.retries ?? defaultRetries) : 0

    let lastError: unknown

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (attempt > 0) await sleep(retryDelay(attempt - 1, retryBaseDelayMs))

      try {
        const response = await doFetch(path, options, context)

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

  /**
   * Single-flight coalescing of identical in-flight GETs: concurrent callers
   * asking for the same URL share one request instead of stampeding the
   * backend. All sharers receive the same parsed object — treat it as
   * read-only. Skipped when the call carries its own `signal` or per-call
   * headers, since those give it semantics the shared result can't honour;
   * entries are removed as soon as the request settles, so a later call
   * refetches rather than caching here (caching is `@sanvi/query`'s job).
   */
  const inFlightGets = new Map<string, Promise<unknown>>()

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET'
    const canShare =
      method === 'GET' && options.signal === undefined && options.headers === undefined
    if (!canShare) return requestWithRetries<T>(path, options)

    // Two GETs may share a response only when everything that shapes it
    // matches — not just the URL. Without the captured context in the key, a
    // request still in flight for tenant A would be handed to a caller that
    // just switched to tenant B. The context is captured at call time,
    // before any await — a switch in the same tick as the call must not be
    // missed — and also sent verbatim, so the request's *headers* can't
    // silently disagree with its key either.
    const tokenOrPromise = getAuthToken?.()
    const context: ResolvedContext = {
      tenantId: getTenantId?.(),
      localeHeader: locale?.(),
      extraHeaders: getExtraHeaders?.(),
      token: await tokenOrPromise,
    }
    const key = [
      context.token ?? '',
      context.tenantId ?? '',
      context.localeHeader ?? '',
      JSON.stringify(context.extraHeaders ?? {}),
      buildUrl(baseUrl, path, options.query),
    ].join('|')
    const pending = inFlightGets.get(key)
    if (pending) return pending as Promise<T>

    const promise = requestWithRetries<T>(path, options, context).finally(() => {
      if (inFlightGets.get(key) === promise) inFlightGets.delete(key)
    })
    inFlightGets.set(key, promise)
    return promise
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
