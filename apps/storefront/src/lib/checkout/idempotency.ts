export const PENDING_CHECKOUT_ID_STORAGE_KEY = 'sanvi_pending_checkout_id'
export const IDEMPOTENCY_KEY_STORAGE_KEY = 'sanvi_checkout_idempotency_key'
export const IDEMPOTENCY_PAYLOAD_STORAGE_KEY = 'sanvi_checkout_idempotency_payload'
export const IDEMPOTENCY_REFERENCE_STORAGE_KEY = 'sanvi_checkout_idempotency_reference'

export interface CheckoutSessionData {
  idempotencyKey: string
  reference: string
}

export function getPendingCheckoutId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage?.getItem(PENDING_CHECKOUT_ID_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

export function setPendingCheckoutId(id: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage?.setItem(PENDING_CHECKOUT_ID_STORAGE_KEY, id)
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function clearPendingCheckoutId(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage?.removeItem(PENDING_CHECKOUT_ID_STORAGE_KEY)
  } catch {
    // Ignore
  }
}

export function generateUuid(): string {
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

export function getOrCreateCheckoutSession(
  payloadSignature: string,
  explicitReference?: string,
): CheckoutSessionData {
  if (typeof window !== 'undefined') {
    try {
      const existingKey = window.sessionStorage?.getItem(IDEMPOTENCY_KEY_STORAGE_KEY)
      const existingPayload = window.sessionStorage?.getItem(IDEMPOTENCY_PAYLOAD_STORAGE_KEY)
      const existingRef = window.sessionStorage?.getItem(IDEMPOTENCY_REFERENCE_STORAGE_KEY)

      if (
        existingKey &&
        existingPayload === payloadSignature &&
        existingRef &&
        (!explicitReference || existingRef === explicitReference)
      ) {
        return {
          idempotencyKey: existingKey,
          reference: existingRef,
        }
      }
    } catch {
      // Ignore
    }
  }

  const newKey = generateUuid()
  const newRef = explicitReference ?? `order-${Date.now()}`

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage?.setItem(IDEMPOTENCY_KEY_STORAGE_KEY, newKey)
      window.sessionStorage?.setItem(IDEMPOTENCY_PAYLOAD_STORAGE_KEY, payloadSignature)
      window.sessionStorage?.setItem(IDEMPOTENCY_REFERENCE_STORAGE_KEY, newRef)
    } catch {
      // Ignore
    }
  }

  return {
    idempotencyKey: newKey,
    reference: newRef,
  }
}

export function getOrCreateIdempotencyKey(payloadSignature?: string): string {
  if (typeof window !== 'undefined') {
    try {
      const existing = window.sessionStorage?.getItem(IDEMPOTENCY_KEY_STORAGE_KEY)
      const existingPayload = window.sessionStorage?.getItem(IDEMPOTENCY_PAYLOAD_STORAGE_KEY)
      if (existing && (!payloadSignature || existingPayload === payloadSignature)) {
        return existing
      }
    } catch {
      // Ignore
    }
  }

  const newKey = generateUuid()

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage?.setItem(IDEMPOTENCY_KEY_STORAGE_KEY, newKey)
      if (payloadSignature) {
        window.sessionStorage?.setItem(IDEMPOTENCY_PAYLOAD_STORAGE_KEY, payloadSignature)
      }
    } catch {
      // Ignore
    }
  }

  return newKey
}

export function clearIdempotencyKey(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage?.removeItem(IDEMPOTENCY_KEY_STORAGE_KEY)
    window.sessionStorage?.removeItem(IDEMPOTENCY_PAYLOAD_STORAGE_KEY)
    window.sessionStorage?.removeItem(IDEMPOTENCY_REFERENCE_STORAGE_KEY)
  } catch {
    // Ignore
  }
}
