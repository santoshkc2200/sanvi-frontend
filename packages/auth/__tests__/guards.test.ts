import type { Router } from '@sanvi/spa-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { requireAal2, requirePermission, requireSession } from '../src/guards'
import { getLastDeniedPermission, setLastDeniedPermission, setSession } from '../src/store.svelte'
import type { Session } from '../src/session'

function session(overrides: Partial<Session> = {}): Session {
  return {
    userId: 'user-1',
    email: 'alice@example.com',
    emailVerified: true,
    status: 'active',
    memberships: [
      {
        tenant_id: 'tenant-1',
        tenant_slug: 'acme',
        tenant_name: 'Acme',
        role_ids: ['role-1'],
        permissions: ['identity.member.read'],
        status: 'active',
      },
    ],
    aal: 'aal1',
    methods: ['password'],
    authenticatedAt: undefined,
    ...overrides,
  }
}

function fakeRouter(pathname = '/members'): Router & { navigations: string[] } {
  const navigations: string[] = []
  return {
    get pathname() {
      return pathname
    },
    navigate: (path: string) => navigations.push(path),
    navigations,
  } as unknown as Router & { navigations: string[] }
}

describe('requireSession', () => {
  afterEach(() => {
    setSession(null)
  })

  it('rejects and navigates to /login with return_to when signed out', async () => {
    setSession(null)
    const router = fakeRouter('/members')

    const allowed = await requireSession(router)({})

    expect(allowed).toBe(false)
    expect(router.navigations).toEqual(['/login?return_to=%2Fmembers'])
  })

  it('allows the navigation through when a session exists', async () => {
    setSession(session())
    const router = fakeRouter('/members')

    const allowed = await requireSession(router)({})

    expect(allowed).toBe(true)
    expect(router.navigations).toEqual([])
  })
})

describe('requirePermission', () => {
  beforeEach(() => {
    setLastDeniedPermission(undefined)
  })
  afterEach(() => {
    setSession(null)
    setLastDeniedPermission(undefined)
  })

  it('redirects to sign-in (not a permission denial) when signed out', async () => {
    setSession(null)
    const router = fakeRouter('/members')

    const allowed = await requirePermission(router, 'identity.member.grant')({})

    expect(allowed).toBe(false)
    expect(router.navigations[0]).toMatch(/^\/login\?/)
    expect(getLastDeniedPermission()).toBeUndefined()
  })

  it('rejects and records the denied permission when signed in without it', async () => {
    setSession(session())
    const router = fakeRouter('/members')

    const allowed = await requirePermission(router, 'identity.member.grant')({})

    expect(allowed).toBe(false)
    expect(router.navigations).toEqual([]) // no navigation — App.svelte's guardRejected branch renders the 403 in place
    expect(getLastDeniedPermission()).toBe('identity.member.grant')
  })

  it('allows through and clears any stale denial when the permission is granted', async () => {
    setLastDeniedPermission('identity.member.grant')
    setSession(session())
    const router = fakeRouter('/members')

    const allowed = await requirePermission(router, 'identity.member.read')({})

    expect(allowed).toBe(true)
    expect(getLastDeniedPermission()).toBeUndefined()
  })
})

describe('requireAal2', () => {
  afterEach(() => {
    setSession(null)
  })

  it('routes to the step-up path when signed in but only aal1', async () => {
    setSession(session({ aal: 'aal1' }))
    const router = fakeRouter('/tenants')

    const allowed = await requireAal2(router)({})

    expect(allowed).toBe(false)
    expect(router.navigations).toEqual(['/step-up?return_to=%2Ftenants'])
  })

  it('allows through at aal2', async () => {
    setSession(session({ aal: 'aal2' }))
    const router = fakeRouter('/tenants')

    const allowed = await requireAal2(router)({})

    expect(allowed).toBe(true)
  })

  it('redirects to sign-in, not step-up, when signed out entirely', async () => {
    setSession(null)
    const router = fakeRouter('/tenants')

    const allowed = await requireAal2(router)({})

    expect(allowed).toBe(false)
    expect(router.navigations[0]).toMatch(/^\/login\?/)
  })
})
