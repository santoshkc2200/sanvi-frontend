/**
 * Hand-written subset of Ory Kratos's self-service flow JSON — the "bring
 * your own UI" browser-flow shape (`GET {kratos}/self-service/{kind}/browser`
 * with `Accept: application/json`, then `POST`/`GET` the flow's own
 * `ui.action`). No `@ory/*` SDK dependency: the shape is stable, and the
 * official client pulls in axios + a large generated surface for a handful
 * of fields we actually read. Pinned to the Kratos version in
 * `sanvi-backend/docker-compose.yml` — a version bump there should be
 * cross-checked against this file.
 */

export interface UiText {
  id: number
  text: string
  type: 'info' | 'error' | 'success'
  context?: Record<string, unknown>
}

export type UiNodeGroup =
  | 'default'
  | 'password'
  | 'oidc'
  | 'code'
  | 'totp'
  | 'webauthn'
  | 'lookup_secret'
  | 'profile'
  | 'link'
  | 'identifier_first'

export interface UiNodeAttributes {
  node_type: 'input' | 'text' | 'a' | 'img' | 'script'
  name?: string
  /** Input type for `node_type: 'input'` — `text`, `password`, `email`, `hidden`, `submit`, `button`, `checkbox`, `date`. */
  type?: string
  value?: string | number | boolean | null
  required?: boolean
  disabled?: boolean
  autocomplete?: string
  pattern?: string
  href?: string
  src?: string
  id?: string
  /** Present when `node_type: 'text'` — the informational text itself (e.g. a recovery code list). */
  text?: UiText
}

export interface UiNode {
  type: 'input' | 'text' | 'img' | 'a' | 'script'
  group: UiNodeGroup
  attributes: UiNodeAttributes
  messages: UiText[]
  meta: { label?: UiText }
}

export interface UiContainer {
  action: string
  method: 'GET' | 'POST'
  nodes: UiNode[]
  messages?: UiText[]
}

export type FlowKind = 'login' | 'registration' | 'recovery' | 'verification' | 'settings'

/** `state` only appears on recovery/verification/settings flows. */
export type FlowState = 'show_form' | 'success' | 'sent_email' | 'passed_challenge'

export interface KratosFlow {
  id: string
  type: 'browser' | 'api'
  ui: UiContainer
  expires_at: string
  issued_at: string
  request_url?: string
  state?: FlowState
  active?: string
}

/** `410 Gone` body Kratos returns for an expired/used flow — carries the id of the flow that replaces it. */
export interface FlowExpiredError {
  error: {
    id: 'self_service_flow_expired'
    code: number
    message: string
  }
  use_flow_id?: string
}

export function isFlowExpiredError(body: unknown): body is FlowExpiredError {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error?: unknown }).error === 'object' &&
    (body as { error?: { id?: unknown } }).error !== null &&
    (body as { error: { id?: unknown } }).error.id === 'self_service_flow_expired'
  )
}
