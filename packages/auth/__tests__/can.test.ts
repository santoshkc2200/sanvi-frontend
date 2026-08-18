import { describe, expect, it } from 'vitest'
import { hasPermission } from '../src/can'
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

describe('hasPermission', () => {
  it('is false with no session', () => {
    expect(hasPermission(null, 'identity.member.read')).toBe(false)
  })

  it('is true when the target tenant membership grants the permission', () => {
    expect(hasPermission(session(), 'identity.member.read', 'tenant-1')).toBe(true)
  })

  it('is false when the membership does not grant the permission', () => {
    expect(hasPermission(session(), 'identity.member.grant', 'tenant-1')).toBe(false)
  })

  it('defaults to the first membership when tenantId is omitted', () => {
    expect(hasPermission(session(), 'identity.member.read')).toBe(true)
  })

  it('is false for a tenant the session has no membership in', () => {
    expect(hasPermission(session(), 'identity.member.read', 'tenant-999')).toBe(false)
  })

  it('is false with no memberships at all', () => {
    expect(hasPermission(session({ memberships: [] }), 'identity.member.read')).toBe(false)
  })
})
