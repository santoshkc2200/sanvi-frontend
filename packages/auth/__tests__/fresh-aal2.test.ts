import { hasFreshAal2 } from '../src/guards'
import { describe, expect, it } from 'vitest'

const NOW = Date.parse('2026-09-03T12:00:00Z')

function session(overrides: { aal?: string; authenticatedAt?: string | undefined } = {}) {
  return {
    aal: overrides.aal ?? 'aal2',
    authenticatedAt:
      'authenticatedAt' in overrides ? overrides.authenticatedAt : '2026-09-03T11:58:00Z',
  }
}

describe('hasFreshAal2 — the backend FreshAal2Policy rule, client-side', () => {
  it('accepts an aal2 session authenticated within the default 300s window', () => {
    // 120s old — well inside the 300s freshness the backend grants on.
    expect(hasFreshAal2(session(), NOW)).toBe(true)
  })

  it('rejects an aal2 session whose authentication is older than the window', () => {
    // 301s old.
    expect(hasFreshAal2(session({ authenticatedAt: '2026-09-03T11:54:59Z' }), NOW)).toBe(false)
  })

  it('rejects an aal1 session regardless of recency', () => {
    expect(
      hasFreshAal2(session({ aal: 'aal1', authenticatedAt: '2026-09-03T11:59:59Z' }), NOW),
    ).toBe(false)
  })

  it('rejects a session with no authentication time — absence of evidence is the stale case', () => {
    expect(hasFreshAal2(session({ authenticatedAt: undefined }), NOW)).toBe(false)
  })

  it('rejects a missing session and an unparseable timestamp', () => {
    expect(hasFreshAal2(null, NOW)).toBe(false)
    expect(hasFreshAal2(undefined, NOW)).toBe(false)
    expect(hasFreshAal2(session({ authenticatedAt: 'not-a-date' }), NOW)).toBe(false)
  })

  it('honours a custom window, matching a backend configured off the default', () => {
    // 120s old: inside a 60s window? No. Inside a 600s one? Yes.
    expect(hasFreshAal2(session(), NOW, 60)).toBe(false)
    expect(hasFreshAal2(session(), NOW, 600)).toBe(true)
  })
})
