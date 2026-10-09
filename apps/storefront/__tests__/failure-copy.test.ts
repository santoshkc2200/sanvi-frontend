import { describe, expect, it } from 'vitest'
import { failureMessageKey, type FailureKind } from '../src/lib/failure-copy'
import { ApiError, failureKindOf } from '@sanvi/api-client'

/**
 * The regression this guards: the failure-kind union is snake_case and the
 * catalog keys are camelCase — interpolating the kind into a template key
 * once rendered the raw key string (`errors.failure.rate_limited`) to users
 * on exactly the outage path this copy exists for.
 */
describe('failure-copy mapping (TASK-023 review finding 1)', () => {
  it('maps every failure kind to a key that exists in the catalog', () => {
    const kinds: FailureKind[] = [
      'rate_limited',
      'overloaded',
      'server_error',
      'timeout',
      'network',
      'client',
    ]
    for (const kind of kinds) {
      expect(failureMessageKey(kind), `kind ${kind} maps to a real key`).toBeTruthy()
      expect(() => failureMessageKey(kind)).not.toThrow()
    }
  })

  it('maps the snake_case kinds to the camelCase catalog keys', () => {
    expect(failureMessageKey('rate_limited')).toBe('errors.failure.rateLimited')
    expect(failureMessageKey('server_error')).toBe('errors.failure.serverError')
    expect(failureMessageKey('overloaded')).toBe('errors.failure.overloaded')
    expect(failureMessageKey('timeout')).toBe('errors.failure.timeout')
    expect(failureMessageKey('network')).toBe('errors.failure.network')
    expect(failureMessageKey('client')).toBe('errors.failure.client')
  })

  it('agrees with failureKindOf — every classifiable kind has copy', () => {
    // 429 and 503 must produce different messages (FR-1112).
    expect(failureMessageKey(failureKindOf(rateLimitedError()))).not.toBe(
      failureMessageKey(failureKindOf(overloadedError())),
    )
  })
})

function rateLimitedError(): unknown {
  return new ApiError(429, { type: 'about:blank', title: 'x', status: 429 }, undefined)
}

function overloadedError(): unknown {
  return new ApiError(503, { type: 'about:blank', title: 'x', status: 503 }, undefined)
}
