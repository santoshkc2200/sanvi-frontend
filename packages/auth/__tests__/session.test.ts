import { ApiError } from '@sanvi/api-client'
import type { TypedApiClient } from '@sanvi/api-client'
import { describe, expect, it, vi } from 'vitest'
import { hydrateSession, membershipFor } from '../src/session'

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
    aal: 'aal2',
    methods: ['password', 'oidc'],
    authenticated_at: '2026-01-01T00:05:00Z',
  },
]

describe('hydrateSession', () => {
  it('combines /me and /me/sessions into one Session', async () => {
    const get = vi.fn((path: string) => {
      if (path === '/api/v1/me') return Promise.resolve(meView)
      if (path === '/api/v1/me/sessions') return Promise.resolve(sessionView)
      throw new Error(`unexpected path ${path}`)
    })

    const session = await hydrateSession(fakeClient({ GET: get as TypedApiClient['GET'] }))

    expect(session).toEqual({
      userId: 'user-1',
      email: 'alice@example.com',
      emailVerified: true,
      status: 'active',
      memberships: meView.memberships,
      aal: 'aal2',
      methods: ['password', 'oidc'],
      authenticatedAt: '2026-01-01T00:05:00Z',
    })
  })

  it('returns null on a 401 (signed out) rather than throwing', async () => {
    const get = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          401,
          { type: 'about:blank', title: 'Not authenticated', status: 401 },
          undefined,
        ),
      )

    await expect(
      hydrateSession(fakeClient({ GET: get as TypedApiClient['GET'] })),
    ).resolves.toBeNull()
  })

  it('rethrows any other failure — "signed out" and "couldn\'t tell" are different states', async () => {
    const get = vi
      .fn()
      .mockRejectedValue(
        new ApiError(500, { type: 'about:blank', title: 'Internal error', status: 500 }, undefined),
      )

    await expect(
      hydrateSession(fakeClient({ GET: get as TypedApiClient['GET'] })),
    ).rejects.toBeInstanceOf(ApiError)
  })
})

describe('membershipFor', () => {
  it('finds the membership matching the given tenant id', async () => {
    const session = await hydrateSession(
      fakeClient({
        GET: vi.fn((path: string) =>
          path === '/api/v1/me' ? Promise.resolve(meView) : Promise.resolve(sessionView),
        ) as TypedApiClient['GET'],
      }),
    )
    expect(membershipFor(session!, 'tenant-1')?.tenant_slug).toBe('acme')
    expect(membershipFor(session!, 'tenant-999')).toBeUndefined()
  })
})
