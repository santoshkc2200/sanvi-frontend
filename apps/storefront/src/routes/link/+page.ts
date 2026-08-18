import { getFlow, startFlow } from '@sanvi/auth'
import { kratosClient } from '$lib/auth'
import type { PageLoad } from './$types'

export const prerender = false
export const ssr = false

/**
 * The account-linking challenge: Kratos reported that `provider`/`subject`
 * collide with an existing account's `email`, which isn't auto-linkable
 * (see `sanvi-backend/docs/phase-02-identity-access`'s linking algorithm —
 * auto-link only fires when both sides are already verified). The user
 * proves ownership of the *existing* account via a fresh login flow scoped
 * to that email before we call `startLinking`.
 *
 * TODO(phase-02 follow-up): the redirect *into* this page — recognizing
 * Kratos's duplicate-identifier response during OIDC login/registration and
 * extracting `provider`/`subject`/`email` from it — needs verification
 * against a live Kratos instance to get the exact node/field shape right;
 * this page implements the linking mechanics themselves, which are fully
 * specified by our own backend contract independent of that detection step.
 */
export const load: PageLoad = async ({ url }) => {
  const provider = url.searchParams.get('provider')
  const subject = url.searchParams.get('subject')
  const email = url.searchParams.get('email')
  if (!provider || !subject || !email) {
    return { challenge: undefined, flow: undefined }
  }

  const flowId = url.searchParams.get('flow')
  const flow = flowId
    ? await getFlow(kratosClient, 'login', flowId)
    : await startFlow(kratosClient, 'login')

  return { challenge: { provider, subject, email }, flow }
}
