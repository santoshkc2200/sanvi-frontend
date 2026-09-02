export const PENDING_CHECKOUT_ID_STORAGE_KEY = 'sanvi_pending_checkout_id'
export const IDEMPOTENCY_KEY_STORAGE_KEY = 'sanvi_checkout_idempotency_key'

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

export function getOrCreateIdempotencyKey(): string {
  if (typeof window !== 'undefined') {
    try {
      const existing = window.sessionStorage?.getItem(IDEMPOTENCY_KEY_STORAGE_KEY)
      if (existing) return existing
    } catch {
      // Ignore
    }
  }

  const newKey = generateUuid()

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage?.setItem(IDEMPOTENCY_KEY_STORAGE_KEY, newKey)
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
  } catch {
    // Ignore
  }
}
