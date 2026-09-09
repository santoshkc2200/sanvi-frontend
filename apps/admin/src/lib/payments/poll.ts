export interface PollOptions<T> {
  minDelayMs?: number
  maxDelayMs?: number
  backoffFactor?: number
  /**
   * Fraction of each delay to randomise by. 0 disables jitter.
   */
  jitterRatio?: number
  onUpdate?: (result: T) => void
  onError?: (error: unknown) => void
  onPollStateChange?: (checking: boolean) => void
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

/**
 * Live-ish polling for connection status while onboarding/setup is in progress.
 * Backs off exponentially, stops when done (e.g. active), and stops when the tab is hidden
 * via the Page Visibility API (resuming immediately when the tab becomes visible).
 */
export function pollPaymentConnection<T>(
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
  let pollSeq = 0
  let running = false
  let stalled = false
  let current: T | undefined
  let lastFetchTime = 0
  let lastChangeTime = 0
  let isChecking = false

  function isTabHidden(): boolean {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden'
  }

  function scheduleNext(): void {
    if (!running) return
    if (isTabHidden()) {
      return
    }
    const spread = currentDelay * jitterRatio
    const delayToWait = currentDelay + (spread > 0 ? Math.random() * spread : 0)
    currentDelay = Math.min(currentDelay * backoffFactor, maxDelayMs)
    timer = setTimeout(() => {
      void executePoll()
    }, delayToWait)
  }

  async function executePoll(): Promise<T | undefined> {
    if (!running) return undefined
    if (isTabHidden()) return undefined

    const seq = ++pollSeq
    if (abortController) {
      abortController.abort()
    }
    const controller = new AbortController()
    abortController = controller
    lastFetchTime = Date.now()
    isChecking = true
    options.onPollStateChange?.(true)

    try {
      const result = await fetchFn(controller.signal)
      if (!running || seq !== pollSeq) return undefined

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
      if (
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        return undefined
      }
      if (!running || seq !== pollSeq) return undefined
      options.onError?.(err)

      if (options.stallTimeoutMs && Date.now() - lastChangeTime >= options.stallTimeoutMs) {
        stalled = true
        stop()
        options.onStalled?.(current)
        return undefined
      }

      scheduleNext()
      return undefined
    } finally {
      if (seq === pollSeq && isChecking) {
        isChecking = false
        options.onPollStateChange?.(false)
      }
    }
  }

  function handleVisibilityChange(): void {
    if (!running) return
    if (!isTabHidden()) {
      // Tab became visible again — resume polling
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
      void executePoll()
    } else {
      // Tab became hidden — pause by clearing pending timer
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
    }
  }

  function start(): void {
    if (running) return
    running = true
    stalled = false
    lastChangeTime = Date.now()
    currentDelay = minDelayMs
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
    if (!isTabHidden()) {
      void executePoll()
    }
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
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    if (isChecking) {
      isChecking = false
      options.onPollStateChange?.(false)
    }
  }

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
