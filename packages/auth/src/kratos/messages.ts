import type { UiText } from './types'

/**
 * A handful of Kratos message ids worth overriding with our own copy —
 * either because the phase-02 UX spec calls for specific wording (the
 * account-linking challenge, generic invalid-credentials messaging) or
 * because Kratos's default English differs from this product's voice.
 * Everything else falls back to `message.text`, which Kratos always
 * populates with a reasonable English default — see {@link translateKratosMessage}.
 * IDs are from Ory's `text/message_*.go` numbering, pinned to the Kratos
 * version in `sanvi-backend/docker-compose.yml`.
 */
const OVERRIDES: Record<number, string> = {
  // "The provided credentials are invalid, check for spelling mistakes in
  // your password or username, email address, or phone number."
  4000006: 'That email or password is incorrect.',
  // "An account with the same identifier (email, phone, username, ...)
  // exists already."
  4000007: 'An account already exists for this email.',
  // Generic rate-limit message Kratos returns for repeated attempts.
  4000001: "You've tried this too many times. Wait a moment and try again.",
}

/**
 * Renders a Kratos `UiText` as plain text — never `{@html}` (Kratos messages
 * are server-controlled, and the rule holds regardless of who controls
 * them). Prefer an id override; fall back to Kratos's own text so an
 * un-catalogued message id still shows something useful instead of a blank
 * field.
 */
export function translateKratosMessage(message: UiText): string {
  return OVERRIDES[message.id] ?? message.text
}
