import type { ProcessingPurpose } from './purposes'

/**
 * Cookie persistence for directive decisions.
 *
 * Constraints that shape this file (phase 05 plan §Security):
 * - first-party, `SameSite=Lax`, `Secure` on https;
 * - contains **no identifiers** — only purpose states and the notice
 *   versions they were made against;
 * - the device reference used to bind a pre-login GPC/opt-out signal is a
 *   random, *rotating* value with no fingerprinting.
 */

export const CONSENT_COOKIE = 'sanvi_consent'
export const DEVICE_COOKIE = 'sanvi_device'

/** The device reference rotates after this many days (see `getOrCreateDeviceRef`). */
export const DEVICE_REF_ROTATION_DAYS = 30

const CONSENT_COOKIE_MAX_AGE_DAYS = 365
const DEVICE_COOKIE_MAX_AGE_DAYS = 60

export { CONSENT_COOKIE_MAX_AGE_DAYS }

/**
 * What the cookie stores, per purpose: the decision (1 allowed / 0 denied)
 * and the notice version it was made against — the re-prompt logic needs
 * the version to know which grants are stale, and a record without the
 * version it consented to is useless as proof.
 */
export interface StoredConsentState {
  /** `purpose -> notice version` the decision was made against. */
  versions: Partial<Record<ProcessingPurpose, string>>
  /** `purpose -> 1 (allowed) | 0 (denied)`. */
  decisions: Partial<Record<ProcessingPurpose, 0 | 1>>
  /** Notice-at-collection acknowledgement (US mode), when present. */
  noticeAck?: string
  /** Set once the GPC signal was transmitted to the backend for this device-ref generation. */
  gpcRecordedAt?: number
  /** When the state was last written (epoch ms) — diagnostics only. */
  updatedAt?: number
}

export function serializeStoredState(state: StoredConsentState): string {
  return encodeURIComponent(JSON.stringify(state))
}

/** Returns null on any corrupt or foreign payload — a bad cookie means "no stored decisions", never a crash. */
export function parseStoredState(raw: string | undefined | null): StoredConsentState | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    if (typeof parsed !== 'object' || parsed === null) return null
    const candidate = parsed as Partial<StoredConsentState>
    if (typeof candidate.decisions !== 'object' || candidate.decisions === null) return null
    if (typeof candidate.versions !== 'object' || candidate.versions === null) return null
    return {
      versions: candidate.versions,
      decisions: candidate.decisions,
      noticeAck: typeof candidate.noticeAck === 'string' ? candidate.noticeAck : undefined,
      gpcRecordedAt:
        typeof candidate.gpcRecordedAt === 'number' ? candidate.gpcRecordedAt : undefined,
      updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Minimal document surface the store needs — `Document` in the browser, a
 * lookalike in tests. Kept narrow so the store can run headless.
 */
export interface CookieDocument {
  cookie: string
}

export function readCookie(doc: CookieDocument, name: string): string | undefined {
  for (const part of doc.cookie.split(';')) {
    const [cookieName, ...rest] = part.trim().split('=')
    if (cookieName === name) return rest.join('=')
  }
  return undefined
}

export function writeCookie(
  doc: CookieDocument,
  name: string,
  value: string,
  maxAgeDays: number,
): void {
  // `Secure` is skipped on http so local/preview origins still persist; the
  // production storefront is https-only.
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
  doc.cookie = `${name}=${value}; Max-Age=${Math.round(maxAgeDays * 24 * 60 * 60)}; Path=/; SameSite=Lax${secure}`
}

/**
 * Returns the stable-for-now device reference, creating or rotating it as
 * needed. Rotation bound: an entry older than {@link DEVICE_REF_ROTATION_DAYS}
 * is replaced with a fresh random value. The value is `crypto.randomUUID()` —
 * random per device *and per rotation*, carrying no entropy from the device.
 */
export function getOrCreateDeviceRef(
  doc: CookieDocument,
  randomId: () => string = defaultRandomId,
  now: () => number = Date.now,
): string {
  const raw = readCookie(doc, DEVICE_COOKIE)
  if (raw) {
    const separator = raw.lastIndexOf('.')
    if (separator > 0) {
      const created = Number(raw.slice(separator + 1))
      if (
        Number.isFinite(created) &&
        now() - created < DEVICE_REF_ROTATION_DAYS * 24 * 60 * 60 * 1000
      ) {
        return raw
      }
    }
  }
  const fresh = `${randomId()}.${now()}`
  writeCookie(doc, DEVICE_COOKIE, fresh, DEVICE_COOKIE_MAX_AGE_DAYS)
  return fresh
}

function defaultRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Non-browser/test fallback — never used where it matters.
  return `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}
