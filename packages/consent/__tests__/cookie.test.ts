import { describe, expect, it } from 'vitest'
import {
  DEVICE_COOKIE,
  getOrCreateDeviceRef,
  parseStoredState,
  readCookie,
  serializeStoredState,
  writeCookie,
  type StoredConsentState,
} from '../src/cookie'

describe('stored consent state serialization', () => {
  it('round-trips a full state', () => {
    const state: StoredConsentState = {
      versions: { analytics: '2026.1' },
      decisions: { analytics: 1, session_replay: 0 },
      noticeAck: '2026.1',
      gpcRecordedAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_001,
    }
    const raw = serializeStoredState(state)
    expect(raw).not.toContain('{') // URI-encoded — no raw JSON in the cookie
    expect(parseStoredState(raw)).toEqual(state)
  })

  it('returns null on corrupt payloads instead of throwing', () => {
    expect(parseStoredState(undefined)).toBeNull()
    expect(parseStoredState('')).toBeNull()
    expect(parseStoredState('%ZZ')).toBeNull()
    expect(parseStoredState(encodeURIComponent('"just a string"'))).toBeNull()
    expect(parseStoredState(encodeURIComponent('{"versions":null,"decisions":null}'))).toBeNull()
  })
})

describe('cookie helpers', () => {
  it('writes with SameSite=Lax, a Max-Age, and reads back what it wrote', () => {
    const doc: { cookie: string } = { cookie: '' }
    writeCookie(doc, 'sanvi_test', 'hello%20world', 30)
    expect(doc.cookie).toContain('sanvi_test=hello%20world')
    expect(doc.cookie).toContain('SameSite=Lax')
    expect(doc.cookie).toContain('Max-Age=')
    expect(readCookie(doc, 'sanvi_test')).toBe('hello%20world')
  })

  it('reads a cookie among others and returns undefined when absent', () => {
    const doc = { cookie: 'a=1; sanvi_consent=x%7Cy; b=2' }
    expect(readCookie(doc, 'sanvi_consent')).toBe('x%7Cy')
    expect(readCookie(doc, 'missing')).toBeUndefined()
  })
})

describe('device reference', () => {
  it('creates one, then returns the same value while fresh', () => {
    const doc = { cookie: '' }
    let calls = 0
    const randomId = () => {
      calls += 1
      return `id-${calls}`
    }
    const first = getOrCreateDeviceRef(doc, randomId, () => 1_000_000)
    expect(calls).toBe(1)
    expect(getOrCreateDeviceRef(doc, randomId, () => 1_000_000 + 1000)).toBe(first)
    expect(calls).toBe(1)
  })

  it('rotates after the rotation window', () => {
    const doc = { cookie: '' }
    let calls = 0
    const randomId = () => {
      calls += 1
      return `id-${calls}`
    }
    const created = 1_000_000
    getOrCreateDeviceRef(doc, randomId, () => created)
    const monthLater = created + 31 * 24 * 60 * 60 * 1000
    const rotated = getOrCreateDeviceRef(doc, randomId, () => monthLater)
    expect(calls).toBe(2)
    expect(rotated.startsWith('id-2.')).toBe(true)
  })

  it('stores the device cookie under the fixed name', () => {
    const doc = { cookie: '' }
    getOrCreateDeviceRef(
      doc,
      () => 'abc',
      () => 5,
    )
    expect(doc.cookie).toContain(`${DEVICE_COOKIE}=abc.5`)
  })
})
