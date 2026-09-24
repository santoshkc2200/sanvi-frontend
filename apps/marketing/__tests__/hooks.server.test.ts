import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { handle } from '../src/hooks.server'

/**
 * TASK-024: marketing's response headers are asserted on the real hook —
 * the CSP from `@sanvi/csp` and the backend-specified security header set
 * (NFR-1114) from `@sanvi/csp/security-headers`. A header removed from
 * either builder fails here instead of shipping.
 */
describe('marketing hooks.server.ts', () => {
  const ORIGINAL_API_ORIGIN = process.env['PUBLIC_API_ORIGIN']

  beforeEach(() => {
    process.env['PUBLIC_API_ORIGIN'] = 'https://api.example.test'
  })

  afterEach(() => {
    if (ORIGINAL_API_ORIGIN === undefined) delete process.env['PUBLIC_API_ORIGIN']
    else process.env['PUBLIC_API_ORIGIN'] = ORIGINAL_API_ORIGIN
  })

  async function respond(pathname = '/') {
    const event = {
      request: new Request(`https://marketing.example.test${pathname}`),
      url: new URL(`https://marketing.example.test${pathname}`),
      cookies: { get: () => undefined },
      setHeaders: () => {},
      locals: {},
    }
    const response = await handle({
      event: event as never,
      resolve: async () => new Response('<html lang="en"></html>', { headers: {} }),
    } as never)
    return response
  }

  it('sets the CSP and the exact specified security headers', async () => {
    const response = await respond()
    const csp = response.headers.get('content-security-policy')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain('frame-ancestors')
    // NFR-1114 set, mirrored from the backend's SecurityHeaders middleware.
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('referrer-policy')).toBe('same-origin')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    )
  })

  it('keeps HSTS off for a localhost host, on for a production host', async () => {
    const local = await respond()
    // The test Request's URL host is marketing.example.test, but the header
    // decision reads the request's `host` header — absent here, so treated
    // as non-local and HSTS is emitted.
    expect(local.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains',
    )

    const event = {
      request: new Request('https://marketing.example.test/', {
        headers: { host: 'localhost:5173' },
      }),
      url: new URL('https://marketing.example.test/'),
      cookies: { get: () => undefined },
      setHeaders: () => {},
      locals: {},
    }
    const response = await handle({
      event: event as never,
      resolve: async () => new Response('<html lang="en"></html>'),
    } as never)
    expect(response.headers.get('strict-transport-security')).toBeNull()
  })
})
