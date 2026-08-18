import type { ApiClient } from '@sanvi/api-client'
import { type FlowExpiredError, type FlowKind, type KratosFlow, isFlowExpiredError } from './types'

/** Kratos returned something other than a flow, a validation-error flow, or an expiry — a real backend problem, not a form error. */
export class KratosRequestError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`Kratos request failed with status ${status}`)
    this.name = 'KratosRequestError'
    this.status = status
    this.body = body
  }
}

export interface StartFlowOptions {
  /** Validated by the caller against `@sanvi/auth`'s own-host allow-list before it ever reaches here — this module trusts what it's given. */
  returnTo?: string
  /** `aal2` requests a step-up login flow (re-authenticate with a second factor) rather than a fresh sign-in — `platform-admin`'s entry requirement. Login flows only. */
  aal?: 'aal1' | 'aal2'
}

/** `GET {kratos}/self-service/{kind}/browser` — `Accept: application/json` (set by every `@sanvi/api-client` request) makes Kratos return the flow as JSON, cookie still set via `Set-Cookie`, instead of a 303 redirect. */
export async function startFlow(
  client: ApiClient,
  kind: FlowKind,
  options: StartFlowOptions = {},
): Promise<KratosFlow> {
  const { status, body } = await client.requestRaw<KratosFlow>(`/self-service/${kind}/browser`, {
    method: 'GET',
    query: {
      return_to: options.returnTo,
      aal: options.aal,
    },
  })
  if (status >= 200 && status < 300 && body) return body
  throw new KratosRequestError(status, body)
}

/** `GET {kratos}/self-service/{kind}/flows?id=...` — resumes a flow from a `?flow=` id in the URL (a page reload, or a redirect back from an OIDC provider). */
export async function getFlow(
  client: ApiClient,
  kind: FlowKind,
  flowId: string,
): Promise<KratosFlow> {
  const { status, body } = await client.requestRaw<KratosFlow>(`/self-service/${kind}/flows`, {
    method: 'GET',
    query: { id: flowId },
  })
  if (status >= 200 && status < 300 && body) return body
  throw new KratosRequestError(status, body)
}

/**
 * The current value of every non-submit input node — hidden fields
 * (`csrf_token`, `method` where Kratos ships it as hidden rather than on the
 * submit button) and anything Kratos has prefilled. Submit/button nodes
 * (the "sign in with password" vs. "continue with Google" triggers) are
 * deliberately excluded: a flow can carry several of them at once, and only
 * the one the user actually activated belongs in the request — the caller
 * passes that one explicitly in `submitFlow`'s `values`.
 */
export function collectNodeValues(flow: KratosFlow): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const node of flow.ui.nodes) {
    if (node.attributes.node_type !== 'input') continue
    if (node.attributes.type === 'submit' || node.attributes.type === 'button') continue
    const { name, value } = node.attributes
    if (name && value !== undefined && value !== null) values[name] = value
  }
  return values
}

export type SubmitFlowResult =
  // Login/registration on success return a session object, not a flow —
  // there's nothing left to render, the caller redirects. Recovery,
  // verification, and settings instead return the *same flow*, updated
  // (`state: 'sent_email' | 'passed_challenge' | 'success'`), because the
  // user stays on that page (e.g. "check your email for a code" before the
  // code has even been entered) — `flow` is set exactly when that's what
  // came back, so the caller knows whether to redirect or keep rendering.
  | { kind: 'success'; flow: KratosFlow | undefined }
  | { kind: 'validation_error'; flow: KratosFlow }
  | { kind: 'expired'; useFlowId: string | undefined }

function isFlowShaped(body: unknown): body is KratosFlow {
  return typeof body === 'object' && body !== null && 'ui' in body
}

/**
 * `POST` (or `GET`, per `flow.ui.method`) to `flow.ui.action` — an absolute
 * Kratos URL already carrying the flow id, so it's passed straight through
 * regardless of this client's `baseUrl`. `values` is merged over
 * {@link collectNodeValues}'s hidden-field defaults, so a caller only needs
 * to supply what the user actually typed plus the activated submit node's
 * `{ [name]: value }`.
 *
 * Never throws for the three outcomes a flow submission ordinarily has
 * (success, "fix these fields", expired) — only for a genuinely unexpected
 * response, which the screen renders as a generic error rather than a form
 * state.
 */
export async function submitFlow(
  client: ApiClient,
  flow: KratosFlow,
  values: Record<string, unknown>,
): Promise<SubmitFlowResult> {
  const body = { ...collectNodeValues(flow), ...values }
  const { status, body: responseBody } = await client.requestRaw<KratosFlow | FlowExpiredError>(
    flow.ui.action,
    { method: flow.ui.method, body },
  )

  if (status >= 200 && status < 300) {
    return { kind: 'success', flow: isFlowShaped(responseBody) ? responseBody : undefined }
  }
  if (status === 410 && isFlowExpiredError(responseBody)) {
    return { kind: 'expired', useFlowId: responseBody.use_flow_id }
  }
  if (status === 400 && isFlowShaped(responseBody)) {
    return { kind: 'validation_error', flow: responseBody }
  }
  throw new KratosRequestError(status, responseBody)
}

/** `POST {kratos}/self-service/logout/browser` — starts the logout flow and returns its one-shot token/url, matching Kratos's own two-step logout (fetch the token, then hit `logout_url`) so a bare `<a>`/CSRF-free GET can't sign anyone out. */
export async function requestLogoutUrl(client: ApiClient): Promise<string> {
  const { status, body } = await client.requestRaw<{ logout_url: string; logout_token: string }>(
    '/self-service/logout/browser',
    { method: 'GET' },
  )
  if (status >= 200 && status < 300 && body) return body.logout_url
  throw new KratosRequestError(status, body)
}
