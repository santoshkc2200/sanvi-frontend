import { completeLinkChallenge, startLinkChallenge } from '@sanvi/api-client'
import type { TypedApiClient } from '@sanvi/api-client'

/**
 * The account-linking challenge: started when Kratos reports an
 * "identifier exists" collision (a social login's verified email matches an
 * existing account that isn't auto-linkable). Held in module state, not
 * `sessionStorage` — the phase-02 plan's "nothing sensitive in
 * sessionStorage" rule; the backend's own `sanvi_link_intent` `HttpOnly`
 * cookie is the durable/expiry backstop if the tab is closed mid-flow.
 */
export interface PendingLink {
  provider: string
  subject: string
  email: string
  nonce: string
  expiresAt: number
}

let pending: PendingLink | undefined

export function getPendingLink(): Readonly<PendingLink> | undefined {
  return pending
}

/** `POST /api/v1/auth/link/challenge` — starts the challenge and holds the returned nonce for {@link completeLinking}. */
export async function startLinking(
  client: TypedApiClient,
  challenge: { provider: string; subject: string; email: string; kratosFlowId?: string },
): Promise<void> {
  const response = await startLinkChallenge(client, {
    provider: challenge.provider,
    subject: challenge.subject,
    email: challenge.email,
    kratos_flow_id: challenge.kratosFlowId ?? null,
  })
  pending = {
    provider: challenge.provider,
    subject: challenge.subject,
    email: challenge.email,
    nonce: response.nonce,
    expiresAt: Date.now() + response.expires_in_secs * 1000,
  }
}

/** Discards the in-progress challenge without completing it — safe: no partial link exists server-side, and the intent expires on its own. */
export function abandonLinking(): void {
  pending = undefined
}

/**
 * `POST /api/v1/auth/link/complete` — the browser holds the nonce, the
 * signed-in session (whichever account the user just proved ownership of)
 * proves it's the right account to link to.
 */
export async function completeLinking(
  client: TypedApiClient,
): Promise<{ provider: string; subject: string; linked: boolean }> {
  if (!pending) {
    throw new Error('completeLinking() called with no pending link challenge')
  }
  if (Date.now() > pending.expiresAt) {
    pending = undefined
    throw new Error('This linking request has expired — start over.')
  }
  const result = await completeLinkChallenge(client, { nonce: pending.nonce })
  pending = undefined
  return result
}
