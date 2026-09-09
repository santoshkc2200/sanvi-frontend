export interface PollOptions<T> {
  minDelayMs?: number
  maxDelayMs?: number
  backoffFactor?: number
  /**
   * Fraction of each delay to randomise by, spreading reconnect storms when many
   * tabs wait on the same slow DNS propagation. `0` disables jitter.
   */
  jitterRatio?: number
  onUpdate?: (result: T) => void
  onError?: (error: unknown) => void
  /**
   * Optional stall timeout in milliseconds.
   * After this duration with no change in the polled result, polling stops
   * and reports a distinct "stalled" state.
   */
  stallTimeoutMs?: number
  /**
   * Custom change detector. Return true if `next` differs from `prev`.
   * Defaults to deep JSON comparison.
   */
  hasChanged?: (prev: T, next: T) => boolean
  onStalled?: (lastResult: T | undefined) => void
}

export interface Poller<T> {
  start(): void
  stop(): void
  checkNow(): Promise<T | undefined>
  getCurrent(): T | undefined
  isRunning(): boolean
  isStalled(): boolean
}

export function pollWithBackoff<T>(
  fetchFn: (signal?: AbortSignal) => Promise<T>,
  isDone: (result: T) => boolean,
  options: PollOptions<T> = {},
): Poller<T> {
  const minDelayMs = options.minDelayMs ?? 2000
  const maxDelayMs = options.maxDelayMs ?? 30000
  const backoffFactor = options.backoffFactor ?? 1.5
  const jitterRatio = options.jitterRatio ?? 0.2

  let currentDelay = minDelayMs
  let timer: ReturnType<typeof setTimeout> | undefined
  let abortController: AbortController | undefined
  let running = false
  let stalled = false
  let current: T | undefined
  let lastFetchTime = 0
  let lastChangeTime = 0

  /** Arm the next tick at the current delay, then widen the delay for the tick after it. */
  function scheduleNext(): void {
    if (!running) return
    const spread = currentDelay * jitterRatio
    const delayToWait = currentDelay + (spread > 0 ? Math.random() * spread : 0)
    currentDelay = Math.min(currentDelay * backoffFactor, maxDelayMs)
    timer = setTimeout(() => {
      void executePoll()
    }, delayToWait)
  }

  async function executePoll(): Promise<T | undefined> {
    if (!running) return undefined

    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()
    lastFetchTime = Date.now()

    try {
      const result = await fetchFn(abortController.signal)
      if (!running) return undefined

      if (current === undefined) {
        lastChangeTime = Date.now()
      } else {
        const changed = options.hasChanged
          ? options.hasChanged(current, result)
          : JSON.stringify(current) !== JSON.stringify(result)
        if (changed) {
          lastChangeTime = Date.now()
        }
      }

      current = result
      options.onUpdate?.(result)

      if (isDone(result)) {
        stop()
        return result
      }

      if (options.stallTimeoutMs && Date.now() - lastChangeTime >= options.stallTimeoutMs) {
        stalled = true
        stop()
        options.onStalled?.(result)
        return result
      }

      scheduleNext()
      return result
    } catch (err) {
      if (!running) return undefined
      options.onError?.(err)

      if (options.stallTimeoutMs && Date.now() - lastChangeTime >= options.stallTimeoutMs) {
        stalled = true
        stop()
        options.onStalled?.(current)
        return undefined
      }

      scheduleNext()
      return undefined
    }
  }

  function start(): void {
    if (running) return
    running = true
    stalled = false
    lastChangeTime = Date.now()
    currentDelay = minDelayMs
    void executePoll()
  }

  function stop(): void {
    running = false
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    if (abortController) {
      abortController.abort()
      abortController = undefined
    }
  }

  /**
   * Poll immediately at the user's request, no sooner than `minDelayMs` after
   * the last fetch. A stopped poller stays stopped — `stop()` runs when the
   * work is done or the view is gone, and a manual check must not silently
   * revive an indefinite background loop. Resets the backoff so the ticks that
   * follow a manual check are as responsive as a fresh start.
   */
  async function checkNow(): Promise<T | undefined> {
    if (!running && !stalled) return current
    if (stalled) {
      stalled = false
      running = true
      lastChangeTime = Date.now()
    }
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    const elapsed = Date.now() - lastFetchTime
    if (elapsed < minDelayMs && lastFetchTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, minDelayMs - elapsed))
    }
    if (!running) return current
    currentDelay = minDelayMs
    return executePoll()
  }

  return {
    start,
    stop,
    checkNow,
    getCurrent: () => current,
    isRunning: () => running,
    isStalled: () => stalled,
  }
}
