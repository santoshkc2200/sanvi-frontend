import { ApiError } from '@sanvi/api-client'
import type { TypedApiClient } from '@sanvi/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSession,
  refreshSession,
  setSession,
  startSessionAutoRefresh,
} from '../src/store.svelte'
import type { Session } from '../src/session'

function fakeClient(overrides: Partial<{ GET: TypedApiClient['GET'] }>): TypedApiClient {
  return {
    GET: overrides.GET ?? vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
  } as unknown as TypedApiClient
}

const meView = {
  user_id: 'user-1',
  email: 'alice@example.com',
  email_verified: true,
  status: 'active' as const,
  created_at: '2026-01-01T00:00:00Z',
  memberships: [
    {
      tenant_id: 'tenant-1',
      tenant_slug: 'acme',
      tenant_name: 'Acme',
      role_ids: ['role-1'],
      permissions: ['identity.member.read'],
      status: 'active' as const,
    },
  ],
}

const sessionView = [
  {
    session_id: 'sess-1',
    aal: 'aal1',
    methods: ['password'],
    authenticated_at: '2026-01-01T00:05:00Z',
  },
]

function clientWith(get: (path: string) => Promise<unknown>): TypedApiClient {
  return fakeClient({ GET: vi.fn(get) as TypedApiClient['GET'] })
}

const signedIn: Session = {
  userId: 'user-1',
  email: 'alice@example.com',
  emailVerified: true,
  status: 'active',
  memberships: meView.memberships,
  aal: 'aal1',
  methods: ['password'],
  authenticatedAt: '2026-01-01T00:05:00Z',
}

beforeEach(() => {
  setSession(signedIn)
})

afterEach(() => {
  setSession(null)
})

describe('refreshSession', () => {
  it('re-hydrates the store from the API (e.g. a step-up completed in another tab)', async () => {
    const get = vi.fn((path: string) =>
      path === '/api/v1/me'
        ? Promise.resolve(meView)
        : Promise.resolve([{ ...sessionView[0], aal: 'aal2', methods: ['password', 'totp'] }]),
    )

    await expect(refreshSession(clientWith(get))).resolves.toMatchObject({ aal: 'aal2' })
    expect(getSession()?.aal).toBe('aal2')
  })

  it('clears the store when the session has been revoked (401)', async () => {
    const client = clientWith(() =>
      Promise.reject(
        new ApiError(
          401,
          { type: 'about:blank', title: 'Not authenticated', status: 401 },
          undefined,
        ),
      ),
    )

    await expect(refreshSession(client)).resolves.toBeNull()
    expect(getSession()).toBeNull()
  })
})

describe('startSessionAutoRefresh', () => {
  it('refreshes on focus and updates the store', async () => {
    const get = vi.fn((path: string) =>
      path === '/api/v1/me' ? Promise.resolve(meView) : Promise.resolve(sessionView),
    )
    setSession(null)
    const dispose = startSessionAutoRefresh(clientWith(get), { minIntervalMs: 0 })

    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(getSession()).toEqual(signedIn))

    dispose()
  })

  it('collapses focus and visibilitychange within the throttle window into one refresh', async () => {
    const get = vi.fn((path: string) =>
      path === '/api/v1/me' ? Promise.resolve(meView) : Promise.resolve(sessionView),
    )
    const dispose = startSessionAutoRefresh(clientWith(get), { minIntervalMs: 60_000 })

    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(get).toHaveBeenCalled())

    // One refresh = both hydration calls, not six.
    expect(get).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('does nothing while the document is hidden', () => {
    const get = vi.fn()
    const previous = document.visibilityState
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    try {
      const dispose = startSessionAutoRefresh(clientWith(get), { minIntervalMs: 0 })

      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))

      expect(get).not.toHaveBeenCalled()
      dispose()
    } finally {
      Object.defineProperty(document, 'visibilityState', { value: previous, configurable: true })
    }
  })

  it('keeps the last-known session when a refresh fails, and retries on the next focus', async () => {
    const failing = clientWith(() => Promise.reject(new TypeError('fetch failed')))
    const disposeFailing = startSessionAutoRefresh(failing, { minIntervalMs: 0 })

    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(failing.GET).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getSession()).toEqual(signedIn)
    disposeFailing()

    const get = vi.fn((path: string) =>
      path === '/api/v1/me' ? Promise.resolve(meView) : Promise.resolve(sessionView),
    )
    const disposeWorking = startSessionAutoRefresh(clientWith(get), { minIntervalMs: 0 })

    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    expect(getSession()).toEqual(signedIn)

    disposeWorking()
  })

  it('stops refreshing after the disposer runs', async () => {
    const get = vi.fn()
    const dispose = startSessionAutoRefresh(clientWith(get), { minIntervalMs: 0 })
    dispose()

    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(get).not.toHaveBeenCalled()
  })
})
