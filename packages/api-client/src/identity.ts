import type { TypedApiClient } from './typed'

/**
 * `GET /api/v1/me` — the signed-in user's profile, including every tenant
 * membership (with role ids and the effective permissions those roles
 * grant). The single hydration call `@sanvi/auth`'s session store is built
 * on — see `sanvi-frontend/docs/phase-02-auth-ux`.
 */
export function getMe(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/me', signal ? { signal } : undefined)
}

/** `GET /api/v1/me/sessions` — the current session (self-management scope in phase 02). */
export function listSessions(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/me/sessions', signal ? { signal } : undefined)
}

/** `DELETE /api/v1/me/sessions/{session_id}` — revoke a session; takes effect on its next request. */
export function revokeSession(client: TypedApiClient, sessionId: string, signal?: AbortSignal) {
  return client.DELETE('/api/v1/me/sessions/{session_id}', {
    params: { path: { session_id: sessionId } },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `POST /api/v1/auth/link/challenge` — start the account-linking challenge
 * when a social identity collides with an existing account. The response's
 * `nonce` must be held by the caller and resent to
 * {@link completeLinkChallenge} — it is not solely cookie-derived (see the
 * phase-02 plan's "Account-linking nonce" note).
 */
export function startLinkChallenge(
  client: TypedApiClient,
  body: {
    provider: string
    subject: string
    email: string
    kratos_flow_id?: string | null
  },
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/auth/link/challenge', body, signal ? { signal } : undefined)
}

/** `POST /api/v1/auth/link/complete` — complete the linking challenge (authenticated). */
export function completeLinkChallenge(
  client: TypedApiClient,
  body: { nonce?: string | null },
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/auth/link/complete', body, signal ? { signal } : undefined)
}

/** `GET /api/v1/tenant/invitations` — pending and accepted invitations. */
export function listInvitations(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/invitations', signal ? { signal } : undefined)
}

/** `POST /api/v1/tenant/invitations` — invite a member by email. */
export function inviteMember(
  client: TypedApiClient,
  body: { email: string; role_ids: string[] },
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/tenant/invitations', body, signal ? { signal } : undefined)
}

/** `POST /api/v1/tenant/invitations/accept` — redeem an invitation token. */
export function acceptInvitation(
  client: TypedApiClient,
  body: { token: string },
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/tenant/invitations/accept', body, signal ? { signal } : undefined)
}

/** `DELETE /api/v1/tenant/invitations/{invitation_id}` — revoke an invitation. */
export function revokeInvitation(
  client: TypedApiClient,
  invitationId: string,
  signal?: AbortSignal,
) {
  return client.DELETE('/api/v1/tenant/invitations/{invitation_id}', {
    params: { path: { invitation_id: invitationId } },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/tenant/invitations/{invitation_id}/resend` — reissue an invitation. */
export function resendInvitation(
  client: TypedApiClient,
  invitationId: string,
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/tenant/invitations/{invitation_id}/resend', undefined, {
    params: { path: { invitation_id: invitationId } },
    ...(signal ? { signal } : {}),
  })
}

/** `GET /api/v1/tenant/members` — the tenant's members. */
export function listMembers(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/members', signal ? { signal } : undefined)
}

/** `POST /api/v1/tenant/members` — grant a membership directly (no invitation flow). */
export function grantMember(
  client: TypedApiClient,
  body: { email: string; role_ids: string[] },
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/tenant/members', body, signal ? { signal } : undefined)
}

/** `DELETE /api/v1/tenant/members/{user_id}` — revoke a membership (subject to the last-owner guard). */
export function removeMember(client: TypedApiClient, userId: string, signal?: AbortSignal) {
  return client.DELETE('/api/v1/tenant/members/{user_id}', {
    params: { path: { user_id: userId } },
    ...(signal ? { signal } : {}),
  })
}

/** `PATCH /api/v1/tenant/members/{user_id}/roles` — replace a member's roles. */
export function updateMemberRoles(
  client: TypedApiClient,
  userId: string,
  body: { role_ids: string[] },
  signal?: AbortSignal,
) {
  return client.PATCH('/api/v1/tenant/members/{user_id}/roles', body, {
    params: { path: { user_id: userId } },
    ...(signal ? { signal } : {}),
  })
}
