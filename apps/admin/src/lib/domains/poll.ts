export interface PollOptions<T> {
  minDelayMs?: number
  maxDelayMs?: number
  backoffFactor?: number
  onUpdate?: (result: T) => void
  onError?: (error: unknown) => void
}

export interface Poller<T> {
  start(): void
  stop(): void
  checkNow(): Promise<T | undefined>
  getCurrent(): T | undefined
  isRunning(): boolean
}

export function pollWithBackoff<T>(
  fetchFn: (signal?: AbortSignal) => Promise<T>,
  isDone: (result: T) => boolean,
  options: PollOptions<T> = {},
): Poller<T> {
  const minDelayMs = options.minDelayMs ?? 2000
  const maxDelayMs = options.maxDelayMs ?? 30000
  const backoffFactor = options.backoffFactor ?? 1.5

  let currentDelay = minDelayMs
  let timer: ReturnType<typeof setTimeout> | undefined
  let abortController: AbortController | undefined
  let running = false
  let current: T | undefined
  let lastFetchTime = 0

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

      current = result
      options.onUpdate?.(result)

      if (isDone(result)) {
        stop()
        return result
      }

      const delayToWait = currentDelay
      currentDelay = Math.min(currentDelay * backoffFactor, maxDelayMs)
      if (running) {
        timer = setTimeout(() => {
          void executePoll()
        }, delayToWait)
      }
      return result
    } catch (err) {
      if (!running) return undefined
      options.onError?.(err)

      const delayToWait = currentDelay
      currentDelay = Math.min(currentDelay * backoffFactor, maxDelayMs)
      if (running) {
        timer = setTimeout(() => {
          void executePoll()
        }, delayToWait)
      }
      return undefined
    }
  }

  function start(): void {
    if (running) return
    running = true
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

  async function checkNow(): Promise<T | undefined> {
    if (!running) {
      running = true
    }
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    const now = Date.now()
    const elapsed = now - lastFetchTime
    if (elapsed < minDelayMs && lastFetchTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, minDelayMs - elapsed))
    }
    return executePoll()
  }

  return {
    start,
    stop,
    checkNow,
    getCurrent: () => current,
    isRunning: () => running,
  }
}
