import { describe, expect, it, vi } from 'vitest'
import { createSessionLogger } from '../logging'
import type { LoggingAuditEntry, SessionStorageLike } from '../logging'
import type { ReleaseStamp } from '../types'

const PRODUCTION: ReleaseStamp = {
  commit: 'e2eb1d9f0012',
  version: '1.0.0',
  built_at: '2026-01-01T00:00:00Z',
  environment: 'production',
}

const LOCAL: ReleaseStamp = { ...PRODUCTION, environment: 'local' }

function fakeStorage(): SessionStorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  }
}

describe('session logging discipline (FR-1106)', () => {
  it('is off by default in production', () => {
    const logger = createSessionLogger({
      release: PRODUCTION,
      audit: () => {},
      storage: fakeStorage(),
    })
    expect(logger.defaultEnabled).toBe(false)
    expect(logger.isEnabled()).toBe(false)
  })

  it('defaults to on outside production (a dev console nobody has to enable)', () => {
    const logger = createSessionLogger({ release: LOCAL, audit: () => {}, storage: fakeStorage() })
    expect(logger.defaultEnabled).toBe(true)
    expect(logger.isEnabled()).toBe(true)
  })

  it('debug() is a no-op while disabled', () => {
    const write = vi.fn()
    const logger = createSessionLogger({
      release: PRODUCTION,
      audit: () => {},
      storage: fakeStorage(),
      write,
    })
    logger.debug('should not appear')
    expect(write).not.toHaveBeenCalled()
  })

  it('enabling in production is an operator action that emits an audit entry and persists per session', () => {
    const storage = fakeStorage()
    const audits: LoggingAuditEntry[] = []
    const write = vi.fn()
    const logger = createSessionLogger({
      release: PRODUCTION,
      audit: (entry) => audits.push(entry),
      storage,
      write,
      now: () => 1_700_000_000_000,
    })

    logger.enable('op-7')
    expect(logger.isEnabled()).toBe(true)
    expect(storage.store.get('sanvi.session_logging.enabled')).toBe('true')
    expect(audits).toEqual([
      {
        action: 'session_logging.enabled',
        operatorId: 'op-7',
        timestamp: 1_700_000_000_000,
        environment: 'production',
      },
    ])

    logger.debug('user reached the quota wall')
    expect(write).toHaveBeenCalledTimes(1)

    logger.disable('op-7')
    expect(logger.isEnabled()).toBe(false)
    expect(storage.store.has('sanvi.session_logging.enabled')).toBe(false)
    expect(audits[1]?.action).toBe('session_logging.disabled')
  })

  it('a fresh session starts disabled again — enablement cannot outlive the tab', () => {
    // No storage: the session flag simply cannot exist, so the default rules.
    const logger = createSessionLogger({ release: PRODUCTION, audit: () => {} })
    logger.enable('op-7')
    expect(logger.isEnabled()).toBe(false)
  })

  it('log lines are scrubbed before they are written', () => {
    const write = vi.fn()
    const logger = createSessionLogger({
      release: PRODUCTION,
      audit: () => {},
      storage: fakeStorage(),
      write,
    })
    logger.enable('op-7')
    logger.debug('failed for user@example.test with session_token=abc123def456')
    const line = write.mock.calls[0]?.[0] as string
    expect(line).not.toContain('@')
    expect(line).toContain('[removed-email]')
    expect(line).toContain('[removed-secret]')
  })

  it('default-on dev logging is sampled at the session level; an explicit enable is never sampled out', () => {
    const write = vi.fn()
    const sampledOut = createSessionLogger({
      release: LOCAL,
      audit: () => {},
      storage: fakeStorage(),
      write,
      sampleRate: 0,
      rng: () => 0.9,
    })
    sampledOut.debug('dropped by the session sample')
    expect(write).not.toHaveBeenCalled()

    // The operator who explicitly asks for logs gets them, whatever the dice said.
    sampledOut.enable('op-7')
    sampledOut.debug('explicitly enabled wins')
    expect(write).toHaveBeenCalledTimes(1)
  })
})
