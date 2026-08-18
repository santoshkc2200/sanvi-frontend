import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '../src/client'
import { ApiError, NetworkError } from '../src/problem'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function problemResponse(status: number, overrides: Partial<Record<string, unknown>> = {}) {
  return new Response(
    JSON.stringify({
      type: 'https://sanvi.app/problems/validation-failed',
      title: 'Validation failed',
      status,
      detail: 'The "email" field is required.',
      ...overrides,
    }),
    { status, headers: { 'content-type': 'application/problem+json' } },
  )
}

describe('createApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** The `[url, init]` args of the nth fetch call — asserts the call happened rather than silently indexing into `undefined`. */
  function fetchCall(n = 0): [string, RequestInit & { headers: Record<string, string> }] {
    const call = fetchMock.mock.calls[n]
    if (!call) throw new Error(`fetch was not called a ${n + 1}th time`)
    return call as [string, RequestInit & { headers: Record<string, string> }]
  }

  it('builds the URL against baseUrl and serializes the body as JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: '1' }))
    const client = createApiClient({ baseUrl: 'https://api.example.com' })

    await client.post('/v1/courses', { title: 'Intro to Rust' })

    const [url, init] = fetchCall()
    expect(url).toBe('https://api.example.com/v1/courses')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ title: 'Intro to Rust' }))
    expect(init.headers['content-type']).toBe('application/json')
  })

  it('omits browser credentials by default', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    const client = createApiClient({ baseUrl: 'https://api.example.com' })

    await client.get('/v1/me')

    expect(fetchCall()[1].credentials).toBe('omit')
  })

  it('sends the session cookie when the caller opts in with credentials: "include"', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    const client = createApiClient({ baseUrl: 'https://api.example.com', credentials: 'include' })

    await client.get('/v1/me')

    expect(fetchCall()[1].credentials).toBe('include')
  })

  it('merges getExtraHeaders in, with an explicit per-call header winning on collision', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      getExtraHeaders: () => ({ cookie: 'ory_kratos_session=abc', 'x-forwarded': '1' }),
    })

    await client.get('/v1/me', { headers: { cookie: 'overridden' } })

    const headers = fetchCall()[1].headers
    expect(headers['cookie']).toBe('overridden')
    expect(headers['x-forwarded']).toBe('1')
  })

  it('appends query params, dropping undefined values', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]))
    const client = createApiClient({ baseUrl: 'https://api.example.com' })

    await client.get('/v1/courses', { query: { page: 2, tag: undefined, published: true } })

    const url = new URL(fetchCall()[0])
    expect(url.pathname).toBe('/v1/courses')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.has('tag')).toBe(false)
    expect(url.searchParams.get('published')).toBe('true')
  })

  it('adds the auth and tenant headers when the client provides them', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      getAuthToken: () => 'session-token',
      getTenantId: () => 'tenant-42',
    })

    await client.get('/v1/me')

    const headers = fetchCall()[1].headers
    expect(headers['authorization']).toBe('Bearer session-token')
    expect(headers['x-tenant-id']).toBe('tenant-42')
    expect(headers['x-request-id']).toBeTruthy()
  })

  it('omits the auth header when getAuthToken resolves to undefined (signed out)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      getAuthToken: () => undefined,
    })

    await client.get('/v1/public')

    expect(fetchCall()[1].headers['authorization']).toBeUndefined()
  })

  it('returns undefined for a 204 No Content response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    const client = createApiClient({ baseUrl: 'https://api.example.com' })

    await expect(client.delete('/v1/courses/1')).resolves.toBeUndefined()
  })

  it('maps a problem+json error response to a typed ApiError and does not retry a 4xx', async () => {
    fetchMock.mockResolvedValueOnce(problemResponse(422))
    const client = createApiClient({ baseUrl: 'https://api.example.com', retries: 2 })

    await expect(client.post('/v1/courses', {})).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      title: 'Validation failed',
      detail: 'The "email" field is required.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a 503 up to the configured count, then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(problemResponse(503, { title: 'Service unavailable' }))
      .mockResolvedValueOnce(problemResponse(503, { title: 'Service unavailable' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      retries: 2,
      retryBaseDelayMs: 1,
    })

    await expect(client.get('/v1/courses')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws the last ApiError once retries are exhausted', async () => {
    fetchMock.mockResolvedValue(problemResponse(500, { title: 'Internal error' }))
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      retries: 1,
      retryBaseDelayMs: 1,
    })

    await expect(client.get('/v1/courses')).rejects.toMatchObject({ status: 500 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('wraps a network failure (fetch rejects) as a NetworkError after retries are exhausted', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      retries: 1,
      retryBaseDelayMs: 1,
    })

    await expect(client.get('/v1/courses')).rejects.toBeInstanceOf(NetworkError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to a synthesized problem when the error body is not problem+json', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>Bad Gateway</html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'content-type': 'text/html' },
      }),
    )
    const client = createApiClient({ baseUrl: 'https://api.example.com', retries: 0 })

    await expect(client.get('/v1/courses')).rejects.toMatchObject({
      status: 502,
      title: 'Bad Gateway',
    })
  })
})

describe('requestRaw', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves with the status and parsed body of a non-2xx, non-problem+json response instead of throwing', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { id: 'self_service_flow_expired' } }), {
        status: 410,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const client = createApiClient({ baseUrl: 'https://kratos.example.com' })

    const result = await client.requestRaw('/self-service/login/flows', { method: 'GET' })

    expect(result.status).toBe(410)
    expect(result.body).toEqual({ error: { id: 'self_service_flow_expired' } })
  })

  it('resolves with an undefined body for a 204 and never retries', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    const client = createApiClient({ baseUrl: 'https://kratos.example.com' })

    const result = await client.requestRaw('/self-service/logout')

    expect(result).toEqual({ status: 204, body: undefined })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('still throws NetworkError on a transport failure — there is no body to hand back', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const client = createApiClient({ baseUrl: 'https://kratos.example.com' })

    await expect(client.requestRaw('/self-service/login/flows')).rejects.toBeInstanceOf(
      NetworkError,
    )
  })
})

describe('ApiError.isRetryable', () => {
  it('is true for 429 and 5xx, false otherwise', () => {
    const retryable = (status: number) =>
      new ApiError(status, { type: 'about:blank', title: 'x', status }, undefined).isRetryable

    expect(retryable(429)).toBe(true)
    expect(retryable(500)).toBe(true)
    expect(retryable(503)).toBe(true)
    expect(retryable(400)).toBe(false)
    expect(retryable(404)).toBe(false)
  })
})
