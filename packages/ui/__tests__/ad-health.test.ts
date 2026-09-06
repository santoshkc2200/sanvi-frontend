import {
  adHealthState,
  EXPIRING_SOON_SECS,
  type AdConnectionHealthData,
} from '../src/advertising/health'
import { describe, expect, it } from 'vitest'

const NOW = Date.parse('2026-09-03T12:00:00Z')

function health(overrides: Partial<AdConnectionHealthData> = {}): AdConnectionHealthData {
  return {
    can_sync: true,
    can_upload_conversions: true,
    scopes_missing: [],
    reconnect_required: false,
    token_expires_at: null,
    last_error: null,
    last_synced_at: '2026-09-03T11:00:00Z',
    ...overrides,
  }
}

describe('adHealthState — one state per connection, most urgent wins', () => {
  it('reads a current, syncing connection as healthy', () => {
    expect(adHealthState('active', health(), NOW)).toBe('healthy')
  })

  it('reads a disconnected connection as disconnected — before any other signal', () => {
    expect(
      adHealthState(
        'disconnected',
        health({ reconnect_required: true, scopes_missing: ['ads.manage'] }),
        NOW,
      ),
    ).toBe('disconnected')
  })

  it('reads reconnect_required as its own state, ahead of missing scopes', () => {
    expect(adHealthState('active', health({ reconnect_required: true }), NOW)).toBe(
      'reconnect_required',
    )
  })

  it('reads an expired status as reconnect_required', () => {
    expect(adHealthState('expired', health(), NOW)).toBe('reconnect_required')
  })

  it('names missing scopes as re-consent, ahead of a failing sync', () => {
    expect(
      adHealthState('active', health({ scopes_missing: ['ads.manage'], can_sync: false }), NOW),
    ).toBe('reconsent_required')
  })

  it('reads a failing sync or upload as sync_failing', () => {
    expect(adHealthState('active', health({ can_sync: false, last_error: 'quota' }), NOW)).toBe(
      'sync_failing',
    )
    expect(adHealthState('active', health({ can_upload_conversions: false }), NOW)).toBe(
      'sync_failing',
    )
  })

  it('flags a token expiring within the week as expiring', () => {
    const soon = new Date(NOW + EXPIRING_SOON_SECS * 1000 - 60_000).toISOString()
    expect(adHealthState('active', health({ token_expires_at: soon }), NOW)).toBe('expiring')
  })

  it('maps an already-lapsed token expiry in the past to reconnect_required', () => {
    const lapsed = new Date(NOW - 60_000).toISOString()
    expect(adHealthState('active', health({ token_expires_at: lapsed }), NOW)).toBe(
      'reconnect_required',
    )
  })

  it('maps a token expiry boundary exactly at nowMs to reconnect_required', () => {
    const boundary = new Date(NOW).toISOString()
    expect(adHealthState('active', health({ token_expires_at: boundary }), NOW)).toBe(
      'reconnect_required',
    )
  })

  it('stays healthy for a token expiring further out than the warning window', () => {
    const later = new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString()
    expect(adHealthState('active', health({ token_expires_at: later }), NOW)).toBe('healthy')
  })

  it('ignores an unparseable expiry rather than inventing a state', () => {
    expect(adHealthState('active', health({ token_expires_at: 'garbage' }), NOW)).toBe('healthy')
  })
})
