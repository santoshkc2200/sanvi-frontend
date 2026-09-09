/**
 * Idempotency key utilities for tenant admin mutations.
 *
 * Provides safe UUID minting with fallback for non-secure contexts,
 * error classification for definitive vs non-definitive failures,
 * and a tracker that holds one stable key per (entity, action) attempt
 * across retries.
 */

export function mintIdempotencyKey(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)
      const b6 = bytes[6]
      const b8 = bytes[8]
      if (b6 !== undefined && b8 !== undefined) {
        bytes[6] = (b6 & 0x0f) | 0x40 // Version 4
        bytes[8] = (b8 & 0x3f) | 0x80 // Variant 10xx
      }
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Determines whether an error is a definitive failure where the mutation
 * certainly did not happen (e.g. 400 validation rejection, 401/403 authorization denial,
 * 404 not found, or 422 unprocessable).
 *
 * Retries on non-definitive errors (500, 502, 503, 504, 408, 429, network failures)
 * must preserve and reuse the idempotency key so the operation remains idempotent.
 */
export function isDefinitiveError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    if ('status' in err && typeof (err as { status: unknown }).status === 'number') {
      const status = (err as { status: number }).status
      return (
        status === 400 ||
        status === 401 ||
        status === 403 ||
        status === 404 ||
        status === 409 ||
        status === 422
      )
    }
  }
  return false
}

/**
 * Tracks idempotency keys per (targetId, action) attempt.
 * A key is minted on first send, preserved across retries of the same attempt,
 * and cleared only on definitive outcome (success, or a definitive error).
 */
export class ActionKeyTracker {
  private keys = new Map<string, string>()

  private keyFor(targetId: string, action: string): string {
    return `${targetId}:${action}`
  }

  getKey(targetId: string, action: string): string | undefined {
    return this.keys.get(this.keyFor(targetId, action))
  }

  getOrMint(targetId: string, action: string): string {
    const mapKey = this.keyFor(targetId, action)
    let existing = this.keys.get(mapKey)
    if (!existing) {
      existing = mintIdempotencyKey()
      this.keys.set(mapKey, existing)
    }
    return existing
  }

  clear(targetId: string, action: string): void {
    this.keys.delete(this.keyFor(targetId, action))
  }

  handleOutcome(targetId: string, action: string, err?: unknown): void {
    if (!err || isDefinitiveError(err)) {
      this.clear(targetId, action)
    }
  }

  clearAll(): void {
    this.keys.clear()
  }
}
