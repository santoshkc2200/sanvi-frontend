import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../src/lib/api'

/**
 * TASK-024's per-app CSRF posture, asserted on the app's *real* client
 * instance (the one every screen in this app mutates through):
 *
 * - every non-GET carries `content-type: application/json` — not
 *   form-representable, so the CORS preflight it forces is the gate a
 *   cross-site request cannot pass;
 * - the session rides `credentials: 'include'` (the HttpOnly Kratos cookie)
 *   and there is no `authorization` header anywhere — this app has no
 *   bearer token to leak, the cookie is the only credential;
 * - the locale cookie the frontend sets is `SameSite=Lax` (this console has
 *   no tenant switcher, so no tenant cookie of its own).
 */

const JSON_RESPONSE = {
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => ({}),
  text: async () => '',
} as unknown as Response

describe('platform-admin CSRF posture (TASK-024)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(JSON_RESPONSE)
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function lastRequest(): RequestInit {
    const call = fetchMock.mock.calls.at(-1)
    if (!call) throw new Error('fetch was not called')
    return call[1] as RequestInit
  }

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    'the app client sends %s with the preflight-forcing content type, cookie credentials, and no bearer token',
    async (method) => {
      await apiClient[method]('/api/v1/example', method === 'DELETE' ? undefined : {})

      const init = lastRequest()
      expect(init.method).toBe(method)
      expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')
      expect(init.credentials).toBe('include')
      expect((init.headers as Record<string, string>)['authorization']).toBeUndefined()
    },
  )

  it('the locale cookie the frontend sets is SameSite=Lax', async () => {
    const assigned: string[] = []
    const setSpy = vi.spyOn(document, 'cookie', 'set')
    setSpy.mockImplementation((value: string) => {
      assigned.push(value)
      return value
    })

    try {
      const { persistLocaleChoice } = await import('@sanvi/i18n')
      persistLocaleChoice('ja')
    } finally {
      setSpy.mockRestore()
    }

    expect(assigned.length).toBeGreaterThanOrEqual(1)
    for (const assignment of assigned) {
      expect(assignment.toLowerCase(), assignment).toContain('samesite=lax')
    }
  })
})
