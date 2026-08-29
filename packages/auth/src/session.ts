import { ApiError, getMe, listSessions } from '@sanvi/api-client'
import type { TypedApiClient, components } from '@sanvi/api-client'

export type MembershipSummary = components['schemas']['MembershipSummary']

/**
 * The hydrated session: `GET /api/v1/me` (identity + every tenant
 * membership, with role ids and effective permissions) plus `GET
 * /api/v1/me/sessions` (`aal`/`methods` — Kratos-tracked, not part of our
 * own `/me` projection). Fetched together so nothing downstream needs a
 * second round trip for either half — `platform-admin`'s `aal2` guard and
 * the tenant switcher both read straight off this one object.
 */
export interface Session {
  userId: string
  email: string
  emailVerified: boolean
  status: components['schemas']['UserStatus']
  memberships: MembershipSummary[]
  aal: string
  methods: string[]
  authenticatedAt: string | undefined
  /** The account's locale preference (`MeView.locale`) — phase 06's "user preference" leg. `undefined` when unset. */
  locale: string | undefined
}

/**
 * `null` on 401 (signed out) — every other failure (network, 5xx) rethrows,
 * since "signed out" and "couldn't tell" are different states a caller
 * should treat differently (redirect to sign-in vs. show an error).
 */
export async function hydrateSession(client: TypedApiClient): Promise<Session | null> {
  try {
    const [me, sessions] = await Promise.all([getMe(client), listSessions(client)])
    const current = sessions[0]
    return {
      userId: me.user_id,
      email: me.email,
      emailVerified: me.email_verified,
      status: me.status,
      memberships: me.memberships,
      aal: current?.aal ?? 'aal1',
      methods: current?.methods ?? [],
      authenticatedAt: current?.authenticated_at ?? undefined,
      locale: me.locale ?? undefined,
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export function membershipFor(session: Session, tenantId: string): MembershipSummary | undefined {
  return session.memberships.find((membership) => membership.tenant_id === tenantId)
}
