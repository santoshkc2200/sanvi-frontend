import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '../src/client'
import {
  DEGRADED_RESPONSE_HEADER,
  failureKindOf,
  NetworkError,
  parseDegradedScopes,
  parseRetryAfterMs,
  PLATFORM_OVERLOADED_PROBLEM_TYPE,
  TimeoutError,
} from '../src/problem'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function problemResponse(
  status: number,
  overrides: Partial<Record<string, unknown>> = {},
  headers: Record<string, string> = {},
) {
  return new Response(
    JSON.stringify({
      type: 'https://sanvi.app/problems/validation-failed',
      title: 'Validation failed',
      status,
      ...overrides,
    }),
    { status, headers: { 'content-type': 'application/problem+json', ...headers } },
  )
}

describe('Retry-After (TASK-023 step 2)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('carries a seconds-valued Retry-After from a 503 on the ApiError', async () => {
    fetchMock.mockResolvedValueOnce(
      problemResponse(
        503,
        { type: PLATFORM_OVERLOADED_PROBLEM_TYPE, title: 'Platform overloaded' },
        { 'retry-after': '7' },
      ),
    )
    const client = createApiClient({ baseUrl: 'https://api.example.com', retries: 0 })

    const error = await client.get('/v1/courses').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 503, retryAfterMs: 7_000 })
  })

  it('parses an HTTP-date Retry-After relative to now', () => {
    const now = Date.parse('2026-10-09T12:00:00Z')
    expect(parseRetryAfterMs('Wed, 09 Oct 2026 12:00:30 GMT', now)).toBe(30_000)
    expect(parseRetryAfterMs('5', now)).toBe(5_000)
    expect(parseRetryAfterMs('garbage', now)).toBeUndefined()
    expect(parseRetryAfterMs(undefined, now)).toBeUndefined()
  })

  it('respects Retry-After on retry instead of the exponential delay', async () => {
    fetchMock
      .mockResolvedValueOnce(
        problemResponse(
          503,
          { type: PLATFORM_OVERLOADED_PROBLEM_TYPE, title: 'Platform overloaded' },
          { 'retry-after': '2' },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      retries: 1,
      retryBaseDelayMs: 10,
    })

    const pending = client.get('/v1/courses')
    // The exponential delay for attempt 0 with a 10 ms base is <100 ms; the
    // header says 2 s — the retry must not fire before it.
    await vi.advanceTimersByTimeAsync(500)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2_000)
    await expect(pending).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('backs 503 off harder than 429 — the two statuses get different delays', async () => {
    const { retryDelayFor } = await import('../src/client')
    const e503 = (await (async () => {
      fetchMock.mockResolvedValueOnce(
        problemResponse(503, { type: PLATFORM_OVERLOADED_PROBLEM_TYPE, title: 'x' }),
      )
      const client = createApiClient({ baseUrl: 'https://api.example.com', retries: 0 })
      return client.get('/v1/x').catch((e: unknown) => e)
    })()) as { retryAfterMs?: number }

    const e429 = (await (async () => {
      fetchMock.mockResolvedValueOnce(problemResponse(429, { title: 'x' }))
      const client = createApiClient({ baseUrl: 'https://api.example.com', retries: 0 })
      return client.get('/v1/x').catch((e: unknown) => e)
    })()) as { retryAfterMs?: number }

    // Both must fail the kind checks for retry-after: neither carries one.
    expect(e503.retryAfterMs).toBeUndefined()
    expect(e429.retryAfterMs).toBeUndefined()

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const d429 = retryDelayFor(e429, attempt, 1_000)
      const d503 = retryDelayFor(e503, attempt, 1_000)
      // 503 = we are too busy (back off harder); 429 = you asked too often
      // (normal exponential). Their windows must never overlap.
      expect(d503).toBeGreaterThanOrEqual(2_000 * 2 ** attempt)
      expect(d503).toBeLessThan(2_000 * 2 ** attempt + 1_000)
      expect(d429).toBeGreaterThanOrEqual(1_000 * 2 ** attempt)
      expect(d429).toBeLessThan(1_000 * 2 ** attempt + 1_000)
    }
  })

  it('classifies failure kinds so 429 and 503 render different copy', async () => {
    fetchMock.mockResolvedValueOnce(problemResponse(429, { title: 'x' }))
    const c1 = createApiClient({ baseUrl: 'https://api.example.com', retries: 0 })
    const e429 = await c1.get('/v1/x').catch((e: unknown) => e)

    fetchMock.mockResolvedValueOnce(
      problemResponse(503, { type: PLATFORM_OVERLOADED_PROBLEM_TYPE, title: 'x' }),
    )
    const c2 = createApiClient({ baseUrl: 'https://api.example.com', retries: 0 })
    const e503 = await c2.get('/v1/x').catch((e: unknown) => e)

    expect(failureKindOf(e429)).toBe('rate_limited')
    expect(failureKindOf(e503)).toBe('overloaded')
    expect(failureKindOf(new TimeoutError(1_000))).toBe('timeout')
    expect(failureKindOf(new NetworkError(new Error('x')))).toBe('network')
    expect(failureKindOf(Object.assign(new Error('x'), { name: 'ApiError' }))).toBe('client')
  })
})

describe('degraded-mode response header (TASK-023 step 2)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('surfaces the degraded scopes of a 2xx response through onResponseMeta', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { degraded: true },
        { headers: { [DEGRADED_RESPONSE_HEADER]: 'advertising-metrics' } },
      ),
    )
    const client = createApiClient({ baseUrl: 'https://api.example.com' })
    const seen: unknown[] = []

    await client.get('/v1/advertising/metrics', {
      onResponseMeta: (meta) => seen.push(meta),
    })

    expect(seen).toEqual([{ status: 200, degradedScopes: ['advertising-metrics'] }])
  })

  it('passes empty scopes for a normal response and parses the header liberally', () => {
    expect(parseDegradedScopes('a b, c')).toEqual(['a', 'b', 'c'])
    expect(parseDegradedScopes('')).toEqual([])
    expect(parseDegradedScopes(null)).toEqual([])
    expect(parseDegradedScopes('a, a b')).toEqual(['a', 'b'])
  })
})

describe('idempotency-aware retry (TASK-023 step 6)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('retries a POST that carries an Idempotency-Key, sending the same key every attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(
        problemResponse(
          503,
          { type: PLATFORM_OVERLOADED_PROBLEM_TYPE, title: 'Platform overloaded' },
          { 'retry-after': '0' },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ id: '1' }))
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      retries: 1,
      retryBaseDelayMs: 1,
    })

    const pending = expect(
      client.post('/v1/courses', { title: 'x' }, { idempotencyKey: 'course-create-42' }),
    ).resolves.toEqual({ id: '1' })
    await vi.advanceTimersByTimeAsync(100)
    await pending
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const headerOf = (call: number): Record<string, string> => {
      const init = fetchMock.mock.calls[call]?.[1] as RequestInit | undefined
      if (!init) throw new Error(`fetch was not called a ${call + 1}th time`)
      return init.headers as Record<string, string>
    }
    expect(headerOf(0)).toMatchObject({ 'idempotency-key': 'course-create-42' })
    expect(headerOf(1)).toMatchObject({ 'idempotency-key': 'course-create-42' })
  })

  it('never retries a non-idempotent POST even when the 503 carries Retry-After', async () => {
    fetchMock.mockResolvedValue(
      problemResponse(
        503,
        { type: PLATFORM_OVERLOADED_PROBLEM_TYPE, title: 'Platform overloaded' },
        { 'retry-after': '1' },
      ),
    )
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      retries: 3,
      retryBaseDelayMs: 1,
    })

    await expect(client.post('/v1/courses', {})).rejects.toMatchObject({ status: 503 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
