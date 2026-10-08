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
 *
 * TASK-022 (audit F10): the pair passes `retries: 0`. These two calls carry
 * one purpose — establishing the session — and are the SPA boot's first
 * cross-origin traffic; against a dead origin the client's default retry
 * ladder (3 attempts × preflight, measured in rc.3) multiplied the
 * boot-error latency several-fold before anything rendered. One attempt,
 * then the caller's error surface with its own retry — TASK-023 owns that
 * surface. The single session-hydration endpoint that would collapse the
 * pair remains the backend ask recorded in the call-pattern audit.
 */
export async function hydrateSession(client: TypedApiClient): Promise<Session | null> {
  try {
    const [me, sessions] = await Promise.all([
      getMe(client, { retries: 0 }),
      listSessions(client, { retries: 0 }),
    ])
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
