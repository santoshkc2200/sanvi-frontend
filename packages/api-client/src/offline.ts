import { ApiError } from './problem'
import type { RequestOptions } from './client'

/**
 * Offline detection and the safe-action queue (TASK-023 step 7, FR-1112).
 *
 * The one rule that shapes this module: **nothing is queued that could
 * execute twice.** "Safe to defer" is a narrower set than it looks — a queued
 * action is a *resend that will happen after the user stopped looking at it*,
 * so it is only queueable when the backend can answer the resend with the
 * original result instead of applying it again. Concretely: a mutation needs
 * an `Idempotency-Key`, or it is not queueable and the honest answer is to
 * say so (the caller shows "this needs a connection" instead of pretending
 * it will happen later).
 */

/** One deferrable action, expressed as a wire request — never a closure, so the queue survives a reload. */
export interface QueuedAction {
  /** Deduplicates enqueue attempts: the same logical action queued twice is one entry, not two sends. */
  id: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  query?: RequestOptions['query']
  /**
   * The `Idempotency-Key` the replay sends. Required for `POST`/`PATCH`
   * (enqueue refuses without one); `PUT`/`DELETE` are idempotent by method,
   * but a stable key is still the recommended belt — the backend then
   * answers the original result rather than re-deriving it.
   */
  idempotencyKey?: string
  headers?: Record<string, string>
}

export interface SafeActionEnqueueResult {
  accepted: boolean
  /** Why an action was refused — the caller's cue to ask instead of queue. */
  reason?: 'not-idempotent' | 'duplicate'
}

export interface QueueEvent {
  kind: 'enqueued' | 'flushed' | 'failed' | 'kept'
  action: QueuedAction
}

export interface OfflineActionQueueOptions {
  /** Any object with `request` — a full `ApiClient` works; tests pass a double. */
  client: Pick<import('./client').ApiClient, 'request'>
  /** @default reads `navigator.onLine`; the queue itself never gates on it (flush is safe any time). */
  isOnline?: () => boolean
  /** Persistence for surviving reloads. Omit for a memory-only queue (SSR, tests). */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  /** @default 'sanvi:offline-queue' */
  storageKey?: string
  onEvent?: (event: QueueEvent) => void
}

const METHODS_NEEDING_KEY = new Set(['POST', 'PATCH'])
const DEFAULT_STORAGE_KEY = 'sanvi:offline-queue'

/**
 * Reads `navigator.onLine` — `true` where the API doesn't exist (SSR, tests
 * with no navigator): the value is an optimization, never a gate, and a
 * wrong `true` only costs one failed request.
 */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean'
    ? true
    : navigator.onLine
}

/**
 * Subscribes to the browser's connectivity transitions. Returns an
 * unsubscribe. Handlers fire on `online`/`offline` events only — no probing —
 * which is honest about what the browser can know: "the OS says the network
 * changed", not "the backend is reachable".
 */
export function watchOnline(handlers: {
  onOnline?: () => void
  onOffline?: () => void
}): () => void {
  if (typeof window === 'undefined') return () => {}
  const online = () => handlers.onOnline?.()
  const offline = () => handlers.onOffline?.()
  window.addEventListener('online', online)
  window.addEventListener('offline', offline)
  return () => {
    window.removeEventListener('online', online)
    window.removeEventListener('offline', offline)
  }
}

export class OfflineActionQueue {
  #client: OfflineActionQueueOptions['client']
  #storage: OfflineActionQueueOptions['storage']
  #storageKey: string
  #onEvent: OfflineActionQueueOptions['onEvent']
  #pending = new Map<string, QueuedAction>()
  #flushing: Promise<{ flushed: number; remaining: number }> | null = null

  constructor(options: OfflineActionQueueOptions) {
    this.#client = options.client
    this.#storage = options.storage ?? defaultStorage()
    this.#storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY
    this.#onEvent = options.onEvent
    this.#hydrate()
  }

  /**
   * Queues an action for later replay — or refuses it. A `POST`/`PATCH`
   * without an idempotency key could execute twice on replay, so it is never
   * accepted: the caller is expected to surface that honestly ("this needs a
   * connection — it will *not* happen automatically") rather than queue and
   * hope. A duplicate action id is a no-op returning `duplicate`.
   */
  enqueue(action: QueuedAction): SafeActionEnqueueResult {
    if (METHODS_NEEDING_KEY.has(action.method) && action.idempotencyKey === undefined) {
      return { accepted: false, reason: 'not-idempotent' }
    }
    if (this.#pending.has(action.id)) return { accepted: false, reason: 'duplicate' }
    this.#pending.set(action.id, action)
    this.#persist()
    this.#onEvent?.({ kind: 'enqueued', action })
    return { accepted: true }
  }

  /** The pending actions, oldest first. Treat as read-only. */
  get pending(): readonly QueuedAction[] {
    return [...this.#pending.values()]
  }

  get pendingCount(): number {
    return this.#pending.size
  }

  /**
   * Replays pending actions strictly one at a time, in enqueue order.
   * Concurrent calls coalesce onto one run — a reconnect stampede cannot
   * double-send (each action is removed *before* its successor starts, and
   * the in-flight run is shared). A retryable failure (503, network, timeout)
   * keeps the action and stops the run — replaying later is the point; a
   * permanent failure (validation, 404) drops the action and reports it:
   * re-sending it later can only fail the same way.
   */
  flush(): Promise<{ flushed: number; remaining: number }> {
    if (this.#flushing) return this.#flushing

    this.#flushing = (async () => {
      let flushed = 0
      while (this.#pending.size > 0) {
        const action = this.#pending.values().next().value as QueuedAction
        try {
          await this.#client.request(action.path, {
            method: action.method,
            body: action.body,
            query: action.query,
            headers: action.headers,
            idempotencyKey: action.idempotencyKey,
          })
        } catch (error) {
          // Anything that is not a typed ApiError (network failure, timeout)
          // is by definition worth retrying later; an ApiError is kept only
          // when the backend itself said the failure is retryable.
          const retryable = !(error instanceof ApiError) || error.isRetryable
          if (retryable) {
            this.#onEvent?.({ kind: 'kept', action })
            break
          }
          this.#pending.delete(action.id)
          this.#persist()
          this.#onEvent?.({ kind: 'failed', action })
          continue
        }
        this.#pending.delete(action.id)
        this.#persist()
        this.#onEvent?.({ kind: 'flushed', action })
        flushed += 1
      }
      return { flushed, remaining: this.#pending.size }
    })().finally(() => {
      this.#flushing = null
    })

    return this.#flushing
  }

  /** Test seam: forget everything without replaying. */
  clear(): void {
    this.#pending.clear()
    this.#persist()
  }

  #hydrate(): void {
    if (!this.#storage) return
    try {
      const raw = this.#storage.getItem(this.#storageKey)
      if (!raw) return
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      for (const entry of parsed) {
        const action = entry as QueuedAction
        if (
          typeof action?.id === 'string' &&
          typeof action?.method === 'string' &&
          typeof action?.path === 'string'
        ) {
          this.#pending.set(action.id, action)
        }
      }
    } catch {
      // A corrupt payload must never break boot — drop it; the user's next
      // enqueue repopulates storage with a clean set.
      this.#pending.clear()
    }
  }

  #persist(): void {
    if (!this.#storage) return
    try {
      if (this.#pending.size === 0) this.#storage.removeItem(this.#storageKey)
      else this.#storage.setItem(this.#storageKey, JSON.stringify(this.pending))
    } catch {
      // Quota/private-mode failures leave the in-memory set authoritative.
    }
  }
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Accessing localStorage can itself throw (sandboxed iframe).
  }
  return undefined
}
