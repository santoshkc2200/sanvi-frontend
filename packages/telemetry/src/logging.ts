import type { ReleaseStamp } from './types'
import { scrubText } from './scrub'

/**
 * Session logging discipline (FR-1106's last sentence, NFR-1104): frontend
 * logging carries no PII, is sampled, is **off by default in production**,
 * and is enabled per session only by an operator action that emits an audit
 * entry.
 *
 * Why an audit sink is a required option rather than an optional one: a
 * logger that could be switched on without producing the audit entry would
 * make the discipline a convention instead of a type error. The app wiring
 * decides where the entry goes (the error tracker's transport, a backend
 * audit endpoint once one exists, or — nowhere, in a test).
 *
 * "Per session" is literal: the flag lives in `sessionStorage` (injectable
 * for tests and SSR), so closing the tab reverts the enablement — an
 * operator enabling debug logging on a user's machine cannot forget to
 * turn it off.
 */

const STORAGE_KEY = 'sanvi.session_logging.enabled'
const FIELD_MAX_LENGTH = 512
const LINE_MAX_LENGTH = 2560

export interface LoggingAuditEntry {
  action: 'session_logging.enabled' | 'session_logging.disabled'
  /** Who flipped it — an operator id, a support ticket reference. Scrubbed like any other free text. */
  operatorId: string
  timestamp: number
  /** The release stamp's environment the action happened in. */
  environment: string
}

/** Minimal `sessionStorage`-like surface, so tests and non-browser runtimes don't need a DOM. */
export interface SessionStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface SessionLoggerOptions {
  /** The build stamp — its `environment` decides whether logging defaults to on. */
  release: ReleaseStamp
  /** Where audit entries go. Required: enabling without an audit trail must not compile. */
  audit: (entry: LoggingAuditEntry) => void
  /** Defaults to `sessionStorage` when present; absent storage means the default is never overridable. */
  storage?: SessionStorageLike
  /** Where log lines are written. Defaults to `console.debug`. */
  write?: (line: string) => void
  /** Session-level log sampling, 0..1. Default 1. An operator's explicit `enable()` is never sampled out — debugging on demand is the point. */
  sampleRate?: number
  rng?: () => number
  now?: () => number
}

export interface SessionLogger {
  /** Whether logging is on without anyone having flipped the session flag. */
  readonly defaultEnabled: boolean
  isEnabled(): boolean
  /** The audited operator action. `operatorId` is required — an anonymous enable is not an audit trail. */
  enable(operatorId: string): void
  disable(operatorId: string): void
  /** Scrubbed, capped, sampled per session. No-op while disabled. */
  debug(message: string, fields?: Record<string, unknown>): void
}

export function createSessionLogger(options: SessionLoggerOptions): SessionLogger {
  const storage = options.storage ?? detectSessionStorage()
  const write = options.write ?? defaultWrite
  const now = options.now ?? Date.now
  const rng = options.rng ?? Math.random
  const sampleRate = options.sampleRate ?? 1
  const defaultEnabled = options.release.environment !== 'production'
  const sampledIn = rng() < sampleRate

  function flagEnabled(): boolean {
    return storage?.getItem(STORAGE_KEY) === 'true'
  }

  function audit(action: LoggingAuditEntry['action'], operatorId: string): void {
    options.audit({
      action,
      operatorId: scrubText(operatorId, 120),
      timestamp: now(),
      environment: options.release.environment,
    })
  }

  return {
    defaultEnabled,
    isEnabled: () => defaultEnabled || flagEnabled(),
    enable(operatorId) {
      storage?.setItem(STORAGE_KEY, 'true')
      audit('session_logging.enabled', operatorId)
    },
    disable(operatorId) {
      storage?.removeItem(STORAGE_KEY)
      audit('session_logging.disabled', operatorId)
    },
    debug(message, fields) {
      if (!this.isEnabled()) return
      // Sampling applies to the default-on dev path only: an operator who
      // explicitly enabled this session gets every line they asked for.
      if (defaultEnabled && !sampledIn && !flagEnabled()) return
      const renderedFields = fields
        ? ` ${JSON.stringify(fields, (_key, value) => (typeof value === 'string' ? value.slice(0, FIELD_MAX_LENGTH) : value))}`
        : ''
      write(scrubText(`${message}${renderedFields}`.slice(0, LINE_MAX_LENGTH)))
    },
  }
}

function detectSessionStorage(): SessionStorageLike | undefined {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage
  } catch {
    // A security-locked-down context can throw on mere access — treat as absent.
  }
  return undefined
}

function defaultWrite(line: string): void {
  // biome-ignore lint/suspicious/noConsole: the default sink for an opt-in debug logger.
  console.debug(line)
}
