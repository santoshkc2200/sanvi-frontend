import type { FailureKind } from '@sanvi/api-client'
import { hasMessage, type MessageKey } from '@sanvi/i18n'

/**
 * Failure kind → catalog key (TASK-023, review finding 1). The kinds are
 * snake_case and the keys camelCase, so the mapping is explicit rather than
 * an interpolated template — an interpolated key that missed rendered the
 * raw key string to the user, on exactly the outage path this copy exists
 * for. Every value is a real `MessageKey` (asserted by `hasMessage` here and
 * by the mapping test), so a drifted kind fails loudly instead of rendering
 * `errors.failure.something` as visible copy.
 */
const FAILURE_KEYS: Record<FailureKind, MessageKey> = {
  rate_limited: 'errors.failure.rateLimited',
  overloaded: 'errors.failure.overloaded',
  server_error: 'errors.failure.serverError',
  timeout: 'errors.failure.timeout',
  network: 'errors.failure.network',
  client: 'errors.failure.client',
}

export function failureMessageKey(kind: FailureKind): MessageKey {
  const key = FAILURE_KEYS[kind]
  if (!hasMessage(key)) {
    console.error(`[failure-copy] key "${key}" is not in the catalog`)
  }
  return key
}
